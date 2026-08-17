package com.vaultr.mobile.autofill

import android.app.PendingIntent
import android.content.Intent
import android.graphics.drawable.Icon
import android.os.Build
import android.os.CancellationSignal
import android.service.autofill.AutofillService
import android.service.autofill.Dataset
import android.service.autofill.Field
import android.service.autofill.FillCallback
import android.service.autofill.FillRequest
import android.service.autofill.FillResponse
import android.service.autofill.InlinePresentation
import android.service.autofill.Presentations
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
        Log.d(TAG, "Vaultr Autofill Service connected")
        AutofillCredentialStore.initialize(applicationContext)
    }

    override fun onFillRequest(
        request: FillRequest,
        cancellationSignal: CancellationSignal,
        callback: FillCallback
    ) {
        AutofillCredentialStore.initialize(applicationContext)

        val contexts = request.fillContexts
        if (contexts.isEmpty()) { callback.onSuccess(null); return }

        val structure = contexts.last().structure
        val parsed = StructureParser.parse(structure)

        Log.d(TAG, "pkg=${parsed.packageName} domain=${parsed.webDomain} hasForm=${parsed.hasCredentialsForm}")

        if (!parsed.hasCredentialsForm || (parsed.usernameId == null && parsed.passwordId == null)) {
            callback.onSuccess(null); return
        }

        val targetQuery = parsed.webDomain ?: parsed.packageName
        val matches = AutofillCredentialStore.findMatches(targetQuery)
        val vaultCount = AutofillCredentialStore.getCount()

        // ── 1. Locked / empty vault → show "Vault is locked" prompt on dropdown & inline keyboard ──
        if (vaultCount == 0) {
            val unlockDataset = buildUnlockDataset(parsed.usernameId, parsed.passwordId, parsed.webDomain, parsed.packageName, request)
            if (unlockDataset != null) {
                callback.onSuccess(FillResponse.Builder().addDataset(unlockDataset).build())
            } else {
                callback.onSuccess(null)
            }
            return
        }

        // ── 2. Unlocked vault → build inline spec context ──
        val inlineReq = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) request.inlineSuggestionsRequest else null
        val inlineSpecs = inlineReq?.inlinePresentationSpecs ?: emptyList()
        val maxInline = inlineReq?.maxSuggestionCount?.takeIf { it > 0 } ?: inlineSpecs.size
        Log.d(TAG, "Inline: specs=${inlineSpecs.size} max=$maxInline IME=${inlineReq?.hostPackageName}")

        val responseBuilder = FillResponse.Builder()

        // Add matched credentials
        for ((index, item) in matches.withIndex()) {
            val menuView = buildMenuView(item)

            val inlineSpec = if (inlineSpecs.isNotEmpty() && index < maxInline)
                inlineSpecs.getOrElse(index) { inlineSpecs.last() }
            else null

            val inlinePresentation = if (inlineSpec != null)
                buildInlineSuggestion(item, inlineSpec)
            else null

            val dataset = buildDataset(parsed.usernameId, parsed.passwordId, item, menuView, inlinePresentation)
            if (dataset != null) responseBuilder.addDataset(dataset)
        }

        // ── Always append "VaultR: Search vault..." at the end (both dropdown & inline) ──
        val searchInlineSpec = if (inlineSpecs.isNotEmpty()) {
            if (matches.size < inlineSpecs.size) inlineSpecs[matches.size] else inlineSpecs.lastOrNull()
        } else null

        val searchDataset = buildVaultrSearchDataset(parsed.usernameId, parsed.passwordId, parsed.webDomain, parsed.packageName, request, searchInlineSpec)
        if (searchDataset != null) {
            responseBuilder.addDataset(searchDataset)
        }

        // SaveInfo — capture new credentials entered in login forms
        val saveIds = listOfNotNull(parsed.usernameId, parsed.passwordId)
        if (saveIds.isNotEmpty()) {
            val saveType = SaveInfo.SAVE_DATA_TYPE_PASSWORD or SaveInfo.SAVE_DATA_TYPE_USERNAME
            responseBuilder.setSaveInfo(SaveInfo.Builder(saveType, saveIds.toTypedArray()).build())
        }

        callback.onSuccess(responseBuilder.build())
    }

    override fun onSaveRequest(request: SaveRequest, callback: SaveCallback) {
        callback.onSuccess()
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Dataset Builder — branches on API level
    // API 33+   → Presentations + Field.Builder (current, non-deprecated)
    // API 30-32 → deprecated setValue with InlinePresentation
    // API <30   → deprecated setValue with RemoteViews only
    // ─────────────────────────────────────────────────────────────────────────

    private fun buildDataset(
        usernameId: AutofillId?,
        passwordId: AutofillId?,
        item: AutofillItem,
        menuView: RemoteViews,
        inlinePresentation: InlinePresentation?
    ): Dataset? {
        if (usernameId == null && passwordId == null) return null
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                buildDatasetApi33(usernameId, passwordId, item, menuView, inlinePresentation)
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && inlinePresentation != null) {
                buildDatasetApi30(usernameId, passwordId, item, menuView, inlinePresentation)
            } else {
                buildDatasetLegacy(usernameId, passwordId, item, menuView)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Dataset build failed for '${item.name}': ${e.message}")
            null
        }
    }

    @RequiresApi(Build.VERSION_CODES.TIRAMISU)
    private fun buildDatasetApi33(
        usernameId: AutofillId?,
        passwordId: AutofillId?,
        item: AutofillItem,
        menuView: RemoteViews,
        inlinePresentation: InlinePresentation?
    ): Dataset {
        val presBuilder = Presentations.Builder().setMenuPresentation(menuView)
        if (inlinePresentation != null) presBuilder.setInlinePresentation(inlinePresentation)
        val presentations = presBuilder.build()

        val datasetBuilder = Dataset.Builder(presentations)
        usernameId?.let {
            val field = Field.Builder()
                .setValue(AutofillValue.forText(item.username))
                .setPresentations(presentations)
                .build()
            datasetBuilder.setField(it, field)
        }
        passwordId?.let {
            val field = Field.Builder()
                .setValue(AutofillValue.forText(item.password))
                .setPresentations(presentations)
                .build()
            datasetBuilder.setField(it, field)
        }
        return datasetBuilder.build()
    }

    @Suppress("DEPRECATION")
    @RequiresApi(Build.VERSION_CODES.R)
    private fun buildDatasetApi30(
        usernameId: AutofillId?,
        passwordId: AutofillId?,
        item: AutofillItem,
        menuView: RemoteViews,
        inlinePresentation: InlinePresentation
    ): Dataset {
        val builder = Dataset.Builder()
        usernameId?.let { builder.setValue(it, AutofillValue.forText(item.username), menuView, inlinePresentation) }
        passwordId?.let { builder.setValue(it, AutofillValue.forText(item.password), menuView, inlinePresentation) }
        return builder.build()
    }

    @Suppress("DEPRECATION")
    private fun buildDatasetLegacy(
        usernameId: AutofillId?,
        passwordId: AutofillId?,
        item: AutofillItem,
        menuView: RemoteViews
    ): Dataset {
        val builder = Dataset.Builder()
        usernameId?.let { builder.setValue(it, AutofillValue.forText(item.username), menuView) }
        passwordId?.let { builder.setValue(it, AutofillValue.forText(item.password), menuView) }
        return builder.build()
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Unlock Dataset (vault is empty / locked)
    // ─────────────────────────────────────────────────────────────────────────

    private fun buildUnlockDataset(
        usernameId: AutofillId?,
        passwordId: AutofillId?,
        webDomain: String?,
        packageName: String?,
        request: FillRequest
    ): Dataset? {
        val targetIds = listOfNotNull(usernameId, passwordId).toTypedArray()
        if (targetIds.isEmpty()) return null

        return try {
            val pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0)
            val unlockIntent = PendingIntent.getActivity(
                this, 8888,
                Intent(this, AutofillSearchActivity::class.java).apply {
                    putExtra("EXTRA_IS_AUTOFILL_REQUEST", true)
                    putExtra("EXTRA_IS_UNLOCK_REQUEST", true)
                    usernameId?.let { putExtra("EXTRA_USERNAME_ID", it) }
                    passwordId?.let { putExtra("EXTRA_PASSWORD_ID", it) }
                    webDomain?.let { putExtra("EXTRA_WEB_DOMAIN", it) }
                    packageName?.let { putExtra("EXTRA_PACKAGE_NAME", it) }
                },
                pendingFlags
            )
            val menuView = buildUnlockMenuView()

            val inlineReq = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) request.inlineSuggestionsRequest else null
            val spec = inlineReq?.inlinePresentationSpecs?.firstOrNull()
            val inlinePresentation = spec?.let { buildCustomInline(it, unlockIntent, "Vault is locked", "Tap to unlock") }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                val presBuilder = Presentations.Builder().setMenuPresentation(menuView)
                if (inlinePresentation != null) presBuilder.setInlinePresentation(inlinePresentation)
                val presentations = presBuilder.build()
                val datasetBuilder = Dataset.Builder(presentations)
                    .setAuthentication(unlockIntent.intentSender)
                for (id in targetIds) {
                    datasetBuilder.setField(id, Field.Builder().setPresentations(presentations).build())
                }
                datasetBuilder.build()
            } else {
                @Suppress("DEPRECATION")
                val builder = Dataset.Builder()
                    .setAuthentication(unlockIntent.intentSender)
                for (id in targetIds) {
                    if (inlinePresentation != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                        @Suppress("DEPRECATION")
                        builder.setValue(id, null, menuView, inlinePresentation)
                    } else {
                        @Suppress("DEPRECATION")
                        builder.setValue(id, null, menuView)
                    }
                }
                builder.build()
            }
        } catch (e: Exception) {
            Log.w(TAG, "buildUnlockDataset failed: ${e.message}")
            null
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Search Dataset ("VaultR: Search to autofill any other item")
    // ─────────────────────────────────────────────────────────────────────────

    private fun buildVaultrSearchDataset(
        usernameId: AutofillId?,
        passwordId: AutofillId?,
        webDomain: String?,
        packageName: String?,
        request: FillRequest,
        inlineSpec: InlinePresentationSpec?
    ): Dataset? {
        val targetIds = listOfNotNull(usernameId, passwordId).toTypedArray()
        if (targetIds.isEmpty()) return null

        return try {
            val pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0)
            val searchIntent = PendingIntent.getActivity(
                this, 9999,
                Intent(this, AutofillSearchActivity::class.java).apply {
                    putExtra("EXTRA_IS_AUTOFILL_REQUEST", true)
                    putExtra("EXTRA_IS_UNLOCK_REQUEST", false)
                    usernameId?.let { putExtra("EXTRA_USERNAME_ID", it) }
                    passwordId?.let { putExtra("EXTRA_PASSWORD_ID", it) }
                    webDomain?.let { putExtra("EXTRA_WEB_DOMAIN", it) }
                    packageName?.let { putExtra("EXTRA_PACKAGE_NAME", it) }
                },
                pendingFlags
            )
            val menuView = buildVaultrSearchMenuView()

            val inlinePresentation = inlineSpec?.let {
                buildCustomInline(it, searchIntent, "VaultR", "Search vault…")
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                val presBuilder = Presentations.Builder().setMenuPresentation(menuView)
                if (inlinePresentation != null) presBuilder.setInlinePresentation(inlinePresentation)
                val presentations = presBuilder.build()
                val datasetBuilder = Dataset.Builder(presentations)
                    .setAuthentication(searchIntent.intentSender)
                for (id in targetIds) {
                    datasetBuilder.setField(id, Field.Builder().setPresentations(presentations).build())
                }
                datasetBuilder.build()
            } else {
                @Suppress("DEPRECATION")
                val builder = Dataset.Builder()
                    .setAuthentication(searchIntent.intentSender)
                for (id in targetIds) {
                    if (inlinePresentation != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                        @Suppress("DEPRECATION")
                        builder.setValue(id, null, menuView, inlinePresentation)
                    } else {
                        @Suppress("DEPRECATION")
                        builder.setValue(id, null, menuView)
                    }
                }
                builder.build()
            }
        } catch (e: Exception) {
            Log.w(TAG, "buildVaultrSearchDataset failed: ${e.message}")
            null
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Inline chip builders — works across Samsung + Gboard
    // ─────────────────────────────────────────────────────────────────────────

    @RequiresApi(Build.VERSION_CODES.R)
    private fun buildInlineSuggestion(item: AutofillItem, spec: InlinePresentationSpec): InlinePresentation? {
        return try {
            val versions = runCatching { UiVersions.getVersions(spec.style) }.getOrDefault(emptyList())
            if (versions.isNotEmpty() && !versions.contains(UiVersions.INLINE_UI_VERSION_1)) {
                Log.d(TAG, "IME explicitly excluded v1, skipping inline for '${item.name}'")
                return null
            }

            val label = item.username.ifBlank { item.name }
            val intent = PendingIntent.getActivity(
                this, item.id.hashCode(),
                Intent(this, MainActivity::class.java).apply { flags = Intent.FLAG_ACTIVITY_NEW_TASK },
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
            val slice = InlineSuggestionUi.newContentBuilder(intent)
                .setTitle(label)
                .setSubtitle("Vaultr • ${item.name}")
                .setStartIcon(Icon.createWithResource(this, R.drawable.ic_vaultr_lock_small))
                .build().slice

            Log.d(TAG, "Inline chip built for '${item.name}' (versions=$versions)")
            InlinePresentation(slice, spec, false)
        } catch (e: Exception) {
            Log.w(TAG, "buildInlineSuggestion failed: ${e.message}")
            null
        }
    }

    @RequiresApi(Build.VERSION_CODES.R)
    private fun buildCustomInline(
        spec: InlinePresentationSpec,
        intent: PendingIntent,
        title: String,
        subtitle: String
    ): InlinePresentation? {
        return try {
            val versions = runCatching { UiVersions.getVersions(spec.style) }.getOrDefault(emptyList())
            if (versions.isNotEmpty() && !versions.contains(UiVersions.INLINE_UI_VERSION_1)) return null
            val slice = InlineSuggestionUi.newContentBuilder(intent)
                .setTitle(title)
                .setSubtitle(subtitle)
                .setStartIcon(Icon.createWithResource(this, R.drawable.ic_vaultr_lock_small))
                .build().slice
            InlinePresentation(slice, spec, false)
        } catch (e: Exception) { null }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RemoteViews helpers
    // ─────────────────────────────────────────────────────────────────────────

    private fun buildMenuView(item: AutofillItem): RemoteViews {
        return RemoteViews(packageName, R.layout.autofill_dataset_item).also {
            it.setTextViewText(R.id.autofill_item_title, item.name)
            it.setTextViewText(R.id.autofill_item_subtitle, item.username.ifBlank { "Password only" })
        }
    }

    private fun buildUnlockMenuView(): RemoteViews {
        return RemoteViews(packageName, R.layout.autofill_dataset_item).also {
            it.setTextViewText(R.id.autofill_item_title, "🔒 Vault is locked")
            it.setTextViewText(R.id.autofill_item_subtitle, "Tap to authenticate and autofill")
        }
    }

    private fun buildVaultrSearchMenuView(): RemoteViews {
        return RemoteViews(packageName, R.layout.autofill_dataset_item).also {
            it.setTextViewText(R.id.autofill_item_title, "VaultR")
            it.setTextViewText(R.id.autofill_item_subtitle, "Search to autofill any other item…")
        }
    }
}

