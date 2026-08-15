package com.vaultr.mobile.autofill

import android.app.PendingIntent
import android.app.slice.Slice
import android.content.Intent
import android.graphics.drawable.Icon
import android.os.Build
import android.os.CancellationSignal
import android.service.autofill.AutofillService
import android.service.autofill.Dataset
import android.service.autofill.FillCallback
import android.service.autofill.FillRequest
import android.service.autofill.FillResponse
import android.service.autofill.InlinePresentation
import android.service.autofill.SaveCallback
import android.service.autofill.SaveInfo
import android.service.autofill.SaveRequest
import android.util.Log
import android.view.autofill.AutofillId
import android.view.autofill.AutofillValue
import android.widget.RemoteViews
import android.widget.inline.InlinePresentationSpec
import com.vaultr.mobile.MainActivity
import com.vaultr.mobile.R

class VaultrAutofillService : AutofillService() {

    companion object {
        private const val TAG = "VaultrAutofillService"
    }

    override fun onConnected() {
        super.onConnected()
        Log.d(TAG, "Vaultr Autofill Service connected to Android OS")
        AutofillCredentialStore.initialize(applicationContext)
    }

    override fun onFillRequest(request: FillRequest, cancellationSignal: CancellationSignal, callback: FillCallback) {
        AutofillCredentialStore.initialize(applicationContext)

        val contexts = request.fillContexts
        if (contexts.isEmpty()) {
            callback.onSuccess(null)
            return
        }

        val structure = contexts.last().structure
        val parsed = StructureParser.parse(structure)

        Log.d(TAG, "onFillRequest: domain=${parsed.webDomain}, pkg=${parsed.packageName}, hasCredentialsForm=${parsed.hasCredentialsForm}, userField=${parsed.usernameId}, passField=${parsed.passwordId}")

        // If not an authentic credential input or form, skip immediately to prevent false-positive popups
        if (!parsed.hasCredentialsForm || (parsed.usernameId == null && parsed.passwordId == null)) {
            callback.onSuccess(null)
            return
        }

        // Target matching priority: Web Domain > Package Name
        val targetQuery = parsed.webDomain ?: parsed.packageName
        val matchingLogins = AutofillCredentialStore.findMatches(targetQuery)
        val allStoredCount = AutofillCredentialStore.getCount()

        val responseBuilder = FillResponse.Builder()
        val targetIds = listOfNotNull(parsed.usernameId, parsed.passwordId).toTypedArray()

        // ── Case 1: Vault is Locked or Empty -> Offer "🔒 Unlock Vaultr" Chip ──
        if (matchingLogins.isEmpty()) {
            if (allStoredCount == 0) {
                // Show "Unlock Vaultr to Autofill" authentication dataset
                val unlockDataset = buildUnlockDataset(targetIds, request)
                if (unlockDataset != null) {
                    responseBuilder.addDataset(unlockDataset)
                    callback.onSuccess(responseBuilder.build())
                    return
                }
            }
            // No matching credentials and vault unlocked -> don't show popup on random pages
            callback.onSuccess(null)
            return
        }

        // ── Case 2: Matching Credentials Found -> Build Suggestion Chips & Dropdowns ──
        for (item in matchingLogins) {
            val datasetBuilder = Dataset.Builder()

            // 1. Dropdown Presentation (RemoteViews)
            val presentation = buildDropdownRemoteViews(item)

            // 2. Inline Keyboard Presentation (Android 11+ / API 30+)
            var inlinePresentation: InlinePresentation? = null
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && request.inlineSuggestionsRequest != null) {
                val inlineSpec = request.inlineSuggestionsRequest?.inlinePresentationSpecs?.firstOrNull()
                if (inlineSpec != null) {
                    inlinePresentation = buildInlinePresentation(item, inlineSpec)
                }
            }

            // Assign values to username and password fields
            if (parsed.usernameId != null) {
                if (inlinePresentation != null) {
                    datasetBuilder.setValue(parsed.usernameId, AutofillValue.forText(item.username), presentation, inlinePresentation)
                } else {
                    datasetBuilder.setValue(parsed.usernameId, AutofillValue.forText(item.username), presentation)
                }
            }

            if (parsed.passwordId != null) {
                if (inlinePresentation != null) {
                    datasetBuilder.setValue(parsed.passwordId, AutofillValue.forText(item.password), presentation, inlinePresentation)
                } else {
                    datasetBuilder.setValue(parsed.passwordId, AutofillValue.forText(item.password), presentation)
                }
            }

            try {
                responseBuilder.addDataset(datasetBuilder.build())
            } catch (e: Exception) {
                Log.w(TAG, "Failed to build dataset for item ${item.name}", e)
            }
        }

        // Setup SaveInfo so user can save or update credentials on submit
        val saveType = SaveInfo.SAVE_DATA_TYPE_PASSWORD or SaveInfo.SAVE_DATA_TYPE_USERNAME
        if (targetIds.isNotEmpty()) {
            val saveInfo = SaveInfo.Builder(saveType, targetIds).build()
            responseBuilder.setSaveInfo(saveInfo)
        }

        callback.onSuccess(responseBuilder.build())
    }

    override fun onSaveRequest(request: SaveRequest, callback: SaveCallback) {
        Log.d(TAG, "onSaveRequest triggered")
        callback.onSuccess()
    }

    private fun buildDropdownRemoteViews(item: AutofillItem): RemoteViews {
        val views = RemoteViews(packageName, R.layout.autofill_dataset_item)
        views.setTextViewText(R.id.autofill_item_title, item.name)
        views.setTextViewText(R.id.autofill_item_subtitle, item.username.ifBlank { "Password Only" })
        return views
    }

    private fun buildUnlockRemoteViews(): RemoteViews {
        val views = RemoteViews(packageName, R.layout.autofill_dataset_item)
        views.setTextViewText(R.id.autofill_item_title, "Unlock Vaultr")
        views.setTextViewText(R.id.autofill_item_subtitle, "Tap to unlock and autofill")
        return views
    }

    private fun buildInlinePresentation(item: AutofillItem, spec: InlinePresentationSpec): InlinePresentation? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return null
        return try {
            val slice = createInlineSlice(item)
            InlinePresentation(slice, spec, false)
        } catch (e: Exception) {
            Log.w(TAG, "Could not create inline presentation", e)
            null
        }
    }

    private fun buildUnlockInlinePresentation(spec: InlinePresentationSpec): InlinePresentation? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return null
        return try {
            val sliceUri = android.net.Uri.parse("content://com.vaultr.mobile.autofill/unlock")
            val builder = Slice.Builder(sliceUri, android.app.slice.SliceSpec("androidx.autofill.inline.ui.version:1", 1))

            builder.addText("Unlock Vaultr", null, listOf(Slice.HINT_TITLE))
            builder.addText("Tap to authenticate", null, listOf(Slice.HINT_SUMMARY))

            val icon = Icon.createWithResource(this, R.drawable.ic_vaultr_lock_small)
            builder.addIcon(icon, null, listOf(Slice.HINT_TITLE))

            val intent = Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            val pendingIntent = PendingIntent.getActivity(
                this,
                9999,
                intent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
            val actionSlice = Slice.Builder(builder).addHints(listOf(Slice.HINT_SHORTCUT)).build()
            builder.addAction(pendingIntent, actionSlice, null)

            InlinePresentation(builder.build(), spec, false)
        } catch (e: Exception) {
            null
        }
    }

    private fun buildUnlockDataset(targetIds: Array<AutofillId>, request: FillRequest): Dataset? {
        if (targetIds.isEmpty()) return null

        val datasetBuilder = Dataset.Builder()
        val presentation = buildUnlockRemoteViews()

        var inlinePresentation: InlinePresentation? = null
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && request.inlineSuggestionsRequest != null) {
            val inlineSpec = request.inlineSuggestionsRequest?.inlinePresentationSpecs?.firstOrNull()
            if (inlineSpec != null) {
                inlinePresentation = buildUnlockInlinePresentation(inlineSpec)
            }
        }

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            8888,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        for (id in targetIds) {
            if (inlinePresentation != null) {
                datasetBuilder.setValue(id, null, presentation, inlinePresentation)
            } else {
                datasetBuilder.setValue(id, null, presentation)
            }
        }

        datasetBuilder.setAuthentication(pendingIntent.intentSender)
        return try {
            datasetBuilder.build()
        } catch (_: Exception) {
            null
        }
    }

    private fun createInlineSlice(item: AutofillItem): Slice {
        val sliceUri = android.net.Uri.parse("content://com.vaultr.mobile.autofill/inline/${item.id}")
        val builder = Slice.Builder(sliceUri, android.app.slice.SliceSpec("androidx.autofill.inline.ui.version:1", 1))

        // Title: username or item name
        val label = if (item.username.isNotBlank()) item.username else item.name
        builder.addText(label, null, listOf(Slice.HINT_TITLE))

        // Subtitle / Brand
        builder.addText("Vaultr • ${item.name}", null, listOf(Slice.HINT_SUMMARY))

        // Icon
        val icon = Icon.createWithResource(this, R.drawable.ic_vaultr_lock_small)
        builder.addIcon(icon, null, listOf(Slice.HINT_TITLE))

        // Action
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            item.id.hashCode(),
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val actionSlice = Slice.Builder(builder).addHints(listOf(Slice.HINT_SHORTCUT)).build()
        builder.addAction(pendingIntent, actionSlice, null)

        return builder.build()
    }
}
