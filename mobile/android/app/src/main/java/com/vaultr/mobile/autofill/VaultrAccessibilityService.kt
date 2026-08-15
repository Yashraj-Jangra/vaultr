package com.vaultr.mobile.autofill

import android.accessibilityservice.AccessibilityService
import android.os.Bundle
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

class VaultrAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG = "VaultrAccessibility"
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.d(TAG, "Vaultr Accessibility Autofill Service connected")
        AutofillCredentialStore.initialize(applicationContext)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        val eventType = event.eventType
        if (eventType == AccessibilityEvent.TYPE_VIEW_FOCUSED || eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            val rootNode = rootInActiveWindow ?: return
            try {
                handleNodeInteraction(rootNode, event.packageName?.toString())
            } catch (e: Exception) {
                Log.w(TAG, "Error handling accessibility event", e)
            }
        }
    }

    override fun onInterrupt() {
        Log.d(TAG, "Accessibility service interrupted")
    }

    private fun handleNodeInteraction(root: AccessibilityNodeInfo, packageName: String?) {
        if (packageName == null || packageName == this.packageName) return

        AutofillCredentialStore.initialize(applicationContext)
        val matchingLogins = AutofillCredentialStore.findMatches(packageName)
        if (matchingLogins.isEmpty()) return

        val bestMatch = matchingLogins.first()

        val userNodes = mutableListOf<AccessibilityNodeInfo>()
        val passNodes = mutableListOf<AccessibilityNodeInfo>()

        findInputNodes(root, userNodes, passNodes)

        // If active password or username field is focused, we have ready credentials
        if (passNodes.isNotEmpty() && bestMatch.password.isNotEmpty()) {
            val passNode = passNodes.first()
            if (passNode.isFocused && passNode.text.isNullOrEmpty()) {
                // Node is focused and empty: ready for fill
                Log.d(TAG, "Found target password field in $packageName for ${bestMatch.name}")
            }
        }
    }

    private fun findInputNodes(
        node: AccessibilityNodeInfo?,
        userNodes: MutableList<AccessibilityNodeInfo>,
        passNodes: MutableList<AccessibilityNodeInfo>
    ) {
        if (node == null) return

        if (node.isPassword) {
            passNodes.add(node)
        } else if (node.isEditable && (node.className?.contains("EditText", ignoreCase = true) == true)) {
            val text = (node.hintText?.toString() ?: node.text?.toString() ?: node.viewIdResourceName ?: "").lowercase()
            if (text.contains("user") || text.contains("email") || text.contains("login")) {
                userNodes.add(node)
            }
        }

        for (i in 0 until node.childCount) {
            findInputNodes(node.getChild(i), userNodes, passNodes)
        }
    }

    fun fillNode(node: AccessibilityNodeInfo, text: String): Boolean {
        val arguments = Bundle()
        arguments.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
        return node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments)
    }
}
