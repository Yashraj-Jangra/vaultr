package com.vaultr.mobile.autofill

import android.app.assist.AssistStructure
import android.text.InputType
import android.util.Log
import android.view.View
import android.view.autofill.AutofillId

data class ParsedStructure(
    val webDomain: String?,
    val packageName: String?,
    val usernameId: AutofillId?,
    val passwordId: AutofillId?,
    val currentFocusedId: AutofillId?,
    val fields: List<AutofillFieldInfo>,
    val hasCredentialsForm: Boolean
)

data class AutofillFieldInfo(
    val id: AutofillId,
    val isUsername: Boolean,
    val isPassword: Boolean,
    val hint: String?,
    val resourceId: String?
)

object StructureParser {
    private const val TAG = "VaultrStructureParser"

    fun parse(structure: AssistStructure): ParsedStructure {
        var detectedDomain: String? = null
        var packageName: String? = null
        var usernameId: AutofillId? = null
        var passwordId: AutofillId? = null
        var currentFocusedId: AutofillId? = null
        val fields = mutableListOf<AutofillFieldInfo>()

        val nodeCount = structure.windowNodeCount
        for (i in 0 until nodeCount) {
            val windowNode = structure.getWindowNodeAt(i)
            val rootNode = windowNode.rootViewNode

            if (packageName == null && structure.activityComponent != null) {
                packageName = structure.activityComponent.packageName
            }

            traverseNode(rootNode) { node ->
                if (node.isFocused) {
                    currentFocusedId = node.autofillId
                }

                // 1. Extract Web Domain from WebView / Browser nodes
                val nodeDomain = node.webDomain
                if (!nodeDomain.isNullOrBlank() && detectedDomain == null) {
                    detectedDomain = nodeDomain
                    Log.d(TAG, "Detected web domain from node: $nodeDomain")
                }

                // Check HTML attributes if available
                if (node.htmlInfo != null && detectedDomain == null) {
                    val tag = node.htmlInfo?.tag
                    if (tag.equals("form", ignoreCase = true) || tag.equals("input", ignoreCase = true)) {
                        node.htmlInfo?.attributes?.forEach { attr ->
                            if (attr.first.equals("action", ignoreCase = true) || attr.first.equals("origin", ignoreCase = true)) {
                                val d = AutofillCredentialStore.normalizeDomain(attr.second)
                                if (d.isNotEmpty() && !d.startsWith("/")) {
                                    detectedDomain = d
                                }
                            }
                        }
                    }
                }

                // 2. Classify Input Fields
                val autofillId = node.autofillId ?: return@traverseNode

                // Explicitly skip search inputs, message composers, URL bars
                if (isExcludedField(node)) {
                    return@traverseNode
                }

                val isEditable = (node.className?.contains("EditText", ignoreCase = true) == true) ||
                        (node.autofillType == View.AUTOFILL_TYPE_TEXT) ||
                        (node.htmlInfo?.tag.equals("input", ignoreCase = true))

                if (isEditable) {
                    val isPass = isPasswordField(node)
                    val isUser = if (isPass) false else isUsernameField(node)

                    if (isUser || isPass) {
                        val fieldInfo = AutofillFieldInfo(
                            id = autofillId,
                            isUsername = isUser,
                            isPassword = isPass,
                            hint = node.hint,
                            resourceId = node.idEntry
                        )
                        fields.add(fieldInfo)

                        if (isUser && usernameId == null) {
                            usernameId = autofillId
                        }
                        if (isPass && passwordId == null) {
                            passwordId = autofillId
                        }
                    }
                }
            }
        }

        // A genuine credential form MUST have at least a password field OR an explicit username field in context
        val hasCredentialsForm = passwordId != null || (usernameId != null && fields.size >= 1)

        return ParsedStructure(
            webDomain = detectedDomain,
            packageName = packageName,
            usernameId = usernameId,
            passwordId = passwordId,
            currentFocusedId = currentFocusedId,
            fields = fields,
            hasCredentialsForm = hasCredentialsForm
        )
    }

    private fun traverseNode(node: AssistStructure.ViewNode?, callback: (AssistStructure.ViewNode) -> Unit) {
        if (node == null) return
        callback(node)
        val childCount = node.childCount
        for (i in 0 until childCount) {
            traverseNode(node.getChildAt(i), callback)
        }
    }

    /**
     * Filters out non-credential inputs like search bars, URL address bars, chat composers, and comments.
     */
    private fun isExcludedField(node: AssistStructure.ViewNode): Boolean {
        val className = node.className?.lowercase() ?: ""
        if (className.contains("searchview") || className.contains("searchedittext")) {
            return true
        }

        val idEntry = node.idEntry?.lowercase() ?: ""
        if (idEntry.contains("search") || idEntry.contains("query") || idEntry.contains("filter") ||
            idEntry.contains("find") || idEntry.contains("url_bar") || idEntry.contains("location_bar") ||
            idEntry.contains("omnibox") || idEntry.contains("address_bar") || idEntry.contains("composer") ||
            idEntry.contains("chat_message") || idEntry.contains("comment") || idEntry.contains("status_text")
        ) {
            return true
        }

        val hint = node.hint?.lowercase() ?: ""
        if (hint.contains("search") || hint.contains("find in") || hint.contains("ask anything") ||
            hint.contains("type a message") || hint.contains("write a comment")
        ) {
            return true
        }

        // Check HTML input type
        if (node.htmlInfo?.tag.equals("input", ignoreCase = true)) {
            val htmlType = node.htmlInfo?.attributes?.find { it.first.equals("type", ignoreCase = true) }?.second?.lowercase() ?: ""
            if (htmlType == "search" || htmlType == "hidden" || htmlType == "checkbox" || htmlType == "radio" || htmlType == "submit" || htmlType == "button") {
                return true
            }
        }

        // Check filter input type
        val inputType = node.inputType
        if ((inputType and InputType.TYPE_TEXT_VARIATION_FILTER) != 0) {
            return true
        }

        return false
    }

    private fun isPasswordField(node: AssistStructure.ViewNode): Boolean {
        // Check autofill hints
        val hints = node.autofillHints
        if (hints != null) {
            for (h in hints) {
                if (h.equals(View.AUTOFILL_HINT_PASSWORD, ignoreCase = true) ||
                    h.equals("newPassword", ignoreCase = true) ||
                    h.equals("currentPassword", ignoreCase = true) ||
                    h.equals("password", ignoreCase = true)
                ) {
                    return true
                }
            }
        }

        // Check input type flags
        val inputType = node.inputType
        val isPassType = (inputType and InputType.TYPE_TEXT_VARIATION_PASSWORD) != 0 ||
                (inputType and InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD) != 0 ||
                (inputType and InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD) != 0 ||
                (inputType and InputType.TYPE_NUMBER_VARIATION_PASSWORD) != 0

        if (isPassType) return true

        // Check HTML input type
        if (node.htmlInfo?.tag.equals("input", ignoreCase = true)) {
            val htmlType = node.htmlInfo?.attributes?.find { it.first.equals("type", ignoreCase = true) }?.second
            if (htmlType.equals("password", ignoreCase = true)) return true
        }

        // Check idEntry or hint text
        val idEntry = node.idEntry?.lowercase() ?: ""
        val hint = node.hint?.lowercase() ?: ""
        return idEntry.contains("password") || idEntry.contains("pass") || idEntry.contains("pwd") ||
                hint.contains("password") || hint.contains("pass") || hint.contains("pin")
    }

    private fun isUsernameField(node: AssistStructure.ViewNode): Boolean {
        if (isPasswordField(node) || isExcludedField(node)) return false

        // Check autofill hints
        val hints = node.autofillHints
        if (hints != null) {
            for (h in hints) {
                if (h.equals(View.AUTOFILL_HINT_USERNAME, ignoreCase = true) ||
                    h.equals(View.AUTOFILL_HINT_EMAIL_ADDRESS, ignoreCase = true) ||
                    h.equals(View.AUTOFILL_HINT_PHONE, ignoreCase = true) ||
                    h.equals("username", ignoreCase = true) ||
                    h.equals("email", ignoreCase = true)
                ) {
                    return true
                }
            }
        }

        // Check input type flags
        val inputType = node.inputType
        val isEmailType = (inputType and InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS) != 0 ||
                (inputType and InputType.TYPE_TEXT_VARIATION_WEB_EMAIL_ADDRESS) != 0

        if (isEmailType) return true

        // Check HTML input type
        if (node.htmlInfo?.tag.equals("input", ignoreCase = true)) {
            val htmlType = node.htmlInfo?.attributes?.find { it.first.equals("type", ignoreCase = true) }?.second?.lowercase() ?: ""
            val htmlName = node.htmlInfo?.attributes?.find { it.first.equals("name", ignoreCase = true) }?.second?.lowercase() ?: ""
            val htmlId = node.htmlInfo?.attributes?.find { it.first.equals("id", ignoreCase = true) }?.second?.lowercase() ?: ""

            if (htmlType == "email" || htmlName.contains("user") || htmlName.contains("email") ||
                htmlName.contains("login") || htmlId.contains("user") || htmlId.contains("email")
            ) {
                return true
            }
        }

        // Check idEntry or hint text
        val idEntry = node.idEntry?.lowercase() ?: ""
        val hint = node.hint?.lowercase() ?: ""
        return (idEntry.contains("username") || idEntry.contains("email") || idEntry.contains("login_id") ||
                idEntry.contains("user_name") || idEntry.contains("account_name")) ||
                (hint.contains("username") || hint.contains("email or phone") || hint.contains("user name") ||
                        hint.contains("email address") || hint.contains("sign in with"))
    }
}
