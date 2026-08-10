package com.vaultr.mobile

import android.app.assist.AssistStructure
import android.os.Build
import android.os.CancellationSignal
import android.service.autofill.*
import android.view.autofill.AutofillId
import android.view.autofill.AutofillValue
import android.widget.RemoteViews
import androidx.annotation.RequiresApi

@RequiresApi(Build.VERSION_CODES.O)
class VaultrAutofillService : AutofillService() {

    override fun onFillRequest(
        request: FillRequest,
        cancellationSignal: CancellationSignal,
        callback: FillCallback
    ) {
        val structure = request.fillContexts.lastOrNull()?.structure ?: run {
            callback.onSuccess(null)
            return
        }

        val packageName = structure.activityComponent.packageName
        val store = AutofillCredentialStore(applicationContext)
        val credentials = store.getCredentialsForDomain(packageName)

        if (credentials.isEmpty()) {
            callback.onSuccess(null)
            return
        }

        val parsedFields = parseFields(structure)
        val usernameId = parsedFields.usernameId
        val passwordId = parsedFields.passwordId

        if (usernameId == null && passwordId == null) {
            callback.onSuccess(null)
            return
        }

        val responseBuilder = FillResponse.Builder()

        for (cred in credentials) {
            val presentation = RemoteViews(packageName, android.R.layout.simple_list_item_1).apply {
                setTextViewText(android.R.id.text1, "${cred.name} (${cred.username})")
            }

            val datasetBuilder = Dataset.Builder()
            if (usernameId != null && cred.username.isNotEmpty()) {
                datasetBuilder.setValue(usernameId, AutofillValue.forText(cred.username), presentation)
            }
            if (passwordId != null && cred.password.isNotEmpty()) {
                datasetBuilder.setValue(passwordId, AutofillValue.forText(cred.password), presentation)
            }

            try {
                responseBuilder.addDataset(datasetBuilder.build())
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        callback.onSuccess(responseBuilder.build())
    }

    override fun onSaveRequest(request: SaveRequest, callback: SaveCallback) {
        callback.onSuccess()
    }

    private data class ParsedFields(
        var usernameId: AutofillId? = null,
        var passwordId: AutofillId? = null
    )

    private fun parseFields(structure: AssistStructure): ParsedFields {
        val fields = ParsedFields()
        for (i in 0 until structure.windowNodeCount) {
            val node = structure.getWindowNodeAt(i).rootViewNode
            traverseNode(node, fields)
        }
        return fields
    }

    private fun traverseNode(node: AssistStructure.ViewNode, fields: ParsedFields) {
        val hints = node.autofillHints
        if (hints != null) {
            for (hint in hints) {
                if (hint.contains("username", ignoreCase = true) || hint.contains("email", ignoreCase = true)) {
                    fields.usernameId = node.autofillId
                } else if (hint.contains("password", ignoreCase = true)) {
                    fields.passwordId = node.autofillId
                }
            }
        }

        val hintText = node.hint?.toString() ?: ""
        if (hintText.contains("username", ignoreCase = true) || hintText.contains("email", ignoreCase = true)) {
            if (fields.usernameId == null) fields.usernameId = node.autofillId
        } else if (hintText.contains("password", ignoreCase = true)) {
            if (fields.passwordId == null) fields.passwordId = node.autofillId
        }

        for (i in 0 until node.childCount) {
            traverseNode(node.getChildAt(i), fields)
        }
    }
}
