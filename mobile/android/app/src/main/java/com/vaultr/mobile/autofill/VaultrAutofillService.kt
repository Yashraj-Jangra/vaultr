package com.vaultr.mobile.autofill

import android.app.PendingIntent
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
import androidx.annotation.RequiresApi
import androidx.autofill.inline.UiVersions
import androidx.autofill.inline.v1.InlineSuggestionUi
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

    override fun onFillRequest(
        request: FillRequest,
        cancellationSignal: CancellationSignal,
        callback: FillCallback
    ) {
        AutofillCredentialStore.initialize(applicationContext)

        val contexts = request.fillContexts
        if (contexts.isEmpty()) {
            callback.onSuccess(null)
            return
        }

        val structure = contexts.last().structure
        val parsed = StructureParser.parse(structure)

        Log.d(TAG, "onFillRequest: domain=${parsed.webDomain}, pkg=${parsed.packageName}, hasCredentialsForm=${parsed.hasCredentialsForm}, user=${parsed.usernameId}, pass=${parsed.passwordId}")

        // Skip if no genuine credential form detected
        if (!parsed.hasCredentialsForm || (parsed.usernameId == null && parsed.passwordId == null)) {
            callback.onSuccess(null)
            return
        }

        val targetQuery = parsed.webDomain ?: parsed.packageName
        val matchingLogins = AutofillCredentialStore.findMatches(targetQuery)
        val vaultCount = AutofillCredentialStore.getCount()
        val targetIds = listOfNotNull(parsed.usernameId, parsed.passwordId).toTypedArray()

        val responseBuilder = FillResponse.Builder()

        // ── Vault Locked / Empty → Show "Unlock Vaultr" chip ──
        if (vaultCount == 0 || matchingLogins.isEmpty() && vaultCount > 0) {
            if (vaultCount == 0) {
                val unlockDataset = buildUnlockDataset(targetIds, request)
                if (unlockDataset != null) {
                    responseBuilder.addDataset(unlockDataset)
                    callback.onSuccess(responseBuilder.build())
                    return
                }
            }
            // Vault unlocked but no matching creds for this domain → no popup
            callback.onSuccess(null)
            return
        }

        // ── Matching Credentials Found ──
        for (item in matchingLogins) {
            val datasetBuilder = Dataset.Builder()
            val presentation = buildDropdownView(item)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R &&
                request.inlineSuggestionsRequest != null
            ) {
                val specs = request.inlineSuggestionsRequest?.inlinePresentationSpecs
                val spec = specs?.firstOrNull()
                if (spec != null) {
                    val inlinePresentation = buildInlineSuggestion(item, spec)
                    if (inlinePresentation != null) {
                        parsed.usernameId?.let {
                            datasetBuilder.setValue(it, AutofillValue.forText(item.username), presentation, inlinePresentation)
                        }
                        parsed.passwordId?.let {
                            datasetBuilder.setValue(it, AutofillValue.forText(item.password), presentation, inlinePresentation)
                        }
                    } else {
                        fillWithDropdown(datasetBuilder, parsed.usernameId, parsed.passwordId, item, presentation)
                    }
                } else {
                    fillWithDropdown(datasetBuilder, parsed.usernameId, parsed.passwordId, item, presentation)
                }
            } else {
                fillWithDropdown(datasetBuilder, parsed.usernameId, parsed.passwordId, item, presentation)
            }

            try {
                responseBuilder.addDataset(datasetBuilder.build())
            } catch (e: Exception) {
                Log.w(TAG, "Failed to build dataset for '${item.name}'", e)
            }
        }

        // SaveInfo — allow saving new credentials from login forms
        if (targetIds.isNotEmpty()) {
            val saveType = SaveInfo.SAVE_DATA_TYPE_PASSWORD or SaveInfo.SAVE_DATA_TYPE_USERNAME
            responseBuilder.setSaveInfo(SaveInfo.Builder(saveType, targetIds).build())
        }

        callback.onSuccess(responseBuilder.build())
    }

    override fun onSaveRequest(request: SaveRequest, callback: SaveCallback) {
        Log.d(TAG, "onSaveRequest triggered")
        callback.onSuccess()
    }

    // ──────────────────────────────────────────
    // Views
    // ──────────────────────────────────────────

    private fun buildDropdownView(item: AutofillItem): RemoteViews {
        val views = RemoteViews(packageName, R.layout.autofill_dataset_item)
        views.setTextViewText(R.id.autofill_item_title, item.name)
        views.setTextViewText(R.id.autofill_item_subtitle, item.username.ifBlank { "Password only" })
        return views
    }

    private fun buildUnlockDropdownView(): RemoteViews {
        val views = RemoteViews(packageName, R.layout.autofill_dataset_item)
        views.setTextViewText(R.id.autofill_item_title, "🔒 Unlock Vaultr")
        views.setTextViewText(R.id.autofill_item_subtitle, "Tap to authenticate and autofill")
        return views
    }

    private fun fillWithDropdown(
        builder: Dataset.Builder,
        usernameId: AutofillId?,
        passwordId: AutofillId?,
        item: AutofillItem,
        presentation: RemoteViews
    ) {
        usernameId?.let { builder.setValue(it, AutofillValue.forText(item.username), presentation) }
        passwordId?.let { builder.setValue(it, AutofillValue.forText(item.password), presentation) }
    }

    // ──────────────────────────────────────────
    // Inline Keyboard Suggestion using androidx.autofill.inline.v1.InlineSuggestionUi
    // ──────────────────────────────────────────

    @RequiresApi(Build.VERSION_CODES.R)
    private fun buildInlineSuggestion(
        item: AutofillItem,
        spec: InlinePresentationSpec
    ): InlinePresentation? {
        return try {
            // Check IME supports inline suggestion version 1
            val supportedVersions = UiVersions.getVersions(spec.style)
            if (!supportedVersions.contains(UiVersions.INLINE_UI_VERSION_1)) {
                Log.d(TAG, "IME doesn't support InlineSuggestionUi v1, skipping")
                return null
            }

            val label = item.username.ifBlank { item.name }
            val subtitle = "Vaultr • ${item.name}"
            val icon = Icon.createWithResource(this, R.drawable.ic_vaultr_lock_small)

            val pendingIntent = PendingIntent.getActivity(
                this,
                item.id.hashCode(),
                Intent(this, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                },
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )

            val contentBuilder = InlineSuggestionUi.newContentBuilder(pendingIntent).apply {
                setTitle(label)
                setSubtitle(subtitle)
                setStartIcon(icon)
            }

            InlinePresentation(contentBuilder.build().slice, spec, false)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to build InlineSuggestionUi: ${e.message}")
            null
        }
    }

    // ──────────────────────────────────────────
    // Unlock Auth Dataset
    // ──────────────────────────────────────────

    private fun buildUnlockDataset(
        targetIds: Array<AutofillId>,
        request: FillRequest
    ): Dataset? {
        if (targetIds.isEmpty()) return null
        return try {
            val datasetBuilder = Dataset.Builder()
            val presentation = buildUnlockDropdownView()

            val pendingIntent = PendingIntent.getActivity(
                this,
                8888,
                Intent(this, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                },
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )

            // Inline unlock chip (Gboard)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R &&
                request.inlineSuggestionsRequest != null
            ) {
                val spec = request.inlineSuggestionsRequest?.inlinePresentationSpecs?.firstOrNull()
                if (spec != null) {
                    val unlockInline = buildUnlockInlineSuggestion(spec, pendingIntent)
                    if (unlockInline != null) {
                        for (id in targetIds) {
                            datasetBuilder.setValue(id, null, presentation, unlockInline)
                        }
                        datasetBuilder.setAuthentication(pendingIntent.intentSender)
                        return datasetBuilder.build()
                    }
                }
            }

            for (id in targetIds) {
                datasetBuilder.setValue(id, null, presentation)
            }
            datasetBuilder.setAuthentication(pendingIntent.intentSender)
            datasetBuilder.build()
        } catch (e: Exception) {
            Log.w(TAG, "Failed to build unlock dataset: ${e.message}")
            null
        }
    }

    @RequiresApi(Build.VERSION_CODES.R)
    private fun buildUnlockInlineSuggestion(
        spec: InlinePresentationSpec,
        pendingIntent: PendingIntent
    ): InlinePresentation? {
        return try {
            val supportedVersions = UiVersions.getVersions(spec.style)
            if (!supportedVersions.contains(UiVersions.INLINE_UI_VERSION_1)) return null

            val icon = Icon.createWithResource(this, R.drawable.ic_vaultr_lock_small)
            val contentBuilder = InlineSuggestionUi.newContentBuilder(pendingIntent).apply {
                setTitle("🔒 Unlock Vaultr")
                setSubtitle("Tap to authenticate")
                setStartIcon(icon)
            }
            InlinePresentation(contentBuilder.build().slice, spec, false)
        } catch (e: Exception) {
            null
        }
    }
}
