package com.vaultr.mobile.autofill

import android.app.PendingIntent
import android.app.slice.Slice
import android.content.Intent
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
import android.util.Size
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

        Log.d(TAG, "onFillRequest: domain=${parsed.webDomain}, pkg=${parsed.packageName}, userField=${parsed.usernameId}, passField=${parsed.passwordId}")

        // Target matching priority: Web Domain > Package Name
        val targetQuery = parsed.webDomain ?: parsed.packageName
        val matchingLogins = AutofillCredentialStore.findMatches(targetQuery)

        if (matchingLogins.isEmpty()) {
            // No direct match found, nothing to show
            callback.onSuccess(null)
            return
        }

        val responseBuilder = FillResponse.Builder()

        // Build dataset for each matching account
        for (item in matchingLogins) {
            val datasetBuilder = Dataset.Builder()

            // 1. Dropdown Presentation (RemoteViews)
            val presentation = buildDropdownRemoteViews(item)

            // 2. Inline Keyboard Presentation (Android 11+ / API 30+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && request.inlineSuggestionsRequest != null) {
                val inlineSpec = request.inlineSuggestionsRequest?.inlinePresentationSpecs?.firstOrNull()
                if (inlineSpec != null) {
                    val inlinePresentation = buildInlinePresentation(item, inlineSpec)
                    if (inlinePresentation != null) {
                        if (parsed.usernameId != null && parsed.passwordId != null) {
                            datasetBuilder.setValue(parsed.usernameId, AutofillValue.forText(item.username), presentation, inlinePresentation)
                            datasetBuilder.setValue(parsed.passwordId, AutofillValue.forText(item.password), presentation, inlinePresentation)
                        } else if (parsed.usernameId != null) {
                            datasetBuilder.setValue(parsed.usernameId, AutofillValue.forText(item.username), presentation, inlinePresentation)
                        } else if (parsed.passwordId != null) {
                            datasetBuilder.setValue(parsed.passwordId, AutofillValue.forText(item.password), presentation, inlinePresentation)
                        }
                    }
                }
            }

            // Fallback for standard dropdown if inline wasn't set or on older API
            if (parsed.usernameId != null && parsed.passwordId != null) {
                datasetBuilder.setValue(parsed.usernameId, AutofillValue.forText(item.username), presentation)
                datasetBuilder.setValue(parsed.passwordId, AutofillValue.forText(item.password), presentation)
            } else if (parsed.usernameId != null) {
                datasetBuilder.setValue(parsed.usernameId, AutofillValue.forText(item.username), presentation)
            } else if (parsed.passwordId != null) {
                datasetBuilder.setValue(parsed.passwordId, AutofillValue.forText(item.password), presentation)
            }

            try {
                responseBuilder.addDataset(datasetBuilder.build())
            } catch (e: Exception) {
                Log.w(TAG, "Failed to build dataset for item ${item.name}", e)
            }
        }

        // Setup SaveInfo so user can save new credentials when submitting
        val saveType = SaveInfo.SAVE_DATA_TYPE_PASSWORD or SaveInfo.SAVE_DATA_TYPE_USERNAME
        val saveIds = listOfNotNull(parsed.usernameId, parsed.passwordId).toTypedArray()
        if (saveIds.isNotEmpty()) {
            val saveInfo = SaveInfo.Builder(saveType, saveIds).build()
            responseBuilder.setSaveInfo(saveInfo)
        }

        callback.onSuccess(responseBuilder.build())
    }

    override fun onSaveRequest(request: SaveRequest, callback: SaveCallback) {
        Log.d(TAG, "onSaveRequest triggered")
        // In this version, saving from external forms launches Vaultr with new item prep
        callback.onSuccess()
    }

    private fun buildDropdownRemoteViews(item: AutofillItem): RemoteViews {
        val views = RemoteViews(packageName, R.layout.autofill_dataset_item)
        views.setTextViewText(R.id.autofill_item_title, item.name)
        views.setTextViewText(R.id.autofill_item_subtitle, item.username.ifBlank { "Password Only" })
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

    private fun createInlineSlice(item: AutofillItem): Slice {
        val sliceUri = android.net.Uri.parse("content://com.vaultr.mobile.autofill/inline/${item.id}")
        val builder = Slice.Builder(sliceUri, android.app.slice.SliceSpec("androidx.autofill.inline.ui.version:1", 1))

        // Label: username or item name
        val label = if (item.username.isNotBlank()) item.username else item.name
        builder.addText(label, null, listOf(Slice.HINT_TITLE))

        // Subtitle / Brand
        builder.addText("Vaultr • ${item.name}", null, listOf(Slice.HINT_SUBTITLE))

        // Intent on click
        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this,
            item.id.hashCode(),
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        builder.addAction(pendingIntent, Slice.Builder(sliceUri).build(), null)

        return builder.build()
    }
}
