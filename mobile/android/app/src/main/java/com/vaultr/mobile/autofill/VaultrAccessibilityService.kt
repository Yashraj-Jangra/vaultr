package com.vaultr.mobile.autofill

import android.accessibilityservice.AccessibilityService
import android.os.Bundle
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * VaultrAccessibilityService
 *
 * Two roles:
 *  1. TRACK: Continuously track the last focused username + password node info
 *     so that the Quick Settings tile can fill credentials into the correct fields.
 *  2. FILL: When PendingFill is set (by AutofillSearchActivity after user selects credentials),
 *     actually inject the username/password text into the tracked nodes.
 */
class VaultrAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG = "VaultrAccessibility"

        // Singleton reference to the live service for QS tile to call
        var instance: VaultrAccessibilityService? = null
            private set

        // Pending credentials to fill into the tracked fields
        @Volatile
        var pendingUsername: String? = null
        @Volatile
        var pendingPassword: String? = null

        fun triggerFill(username: String, password: String) {
            pendingUsername = username
            pendingPassword = password
            instance?.performPendingFill()
        }
    }

    // Tracked nodes from the last focused app
    private var trackedUsernameNode: AccessibilityNodeInfo? = null
    private var trackedPasswordNode: AccessibilityNodeInfo? = null
    private var lastPackage: String? = null

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        Log.d(TAG, "Vaultr Accessibility Service connected")
        AutofillCredentialStore.initialize(applicationContext)
    }

    override fun onDestroy() {
        super.onDestroy()
        if (instance === this) instance = null
    }

    override fun onInterrupt() {
        Log.d(TAG, "Accessibility service interrupted")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        val pkg = event.packageName?.toString() ?: return
        // Ignore events from ourselves
        if (pkg == this.packageName) return

        when (event.eventType) {
            AccessibilityEvent.TYPE_VIEW_FOCUSED,
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED,
            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> {
                try {
                    val root = rootInActiveWindow ?: return
                    if (lastPackage != pkg) {
                        // App switched — reset tracked nodes
                        trackedUsernameNode = null
                        trackedPasswordNode = null
                        lastPackage = pkg
                    }
                    scanAndTrackNodes(root)
                } catch (e: Exception) {
                    Log.w(TAG, "Error scanning nodes", e)
                }
            }
        }
    }

    /**
     * Walk the node tree to find and remember the username + password fields.
     */
    private fun scanAndTrackNodes(root: AccessibilityNodeInfo) {
        val userNodes = mutableListOf<AccessibilityNodeInfo>()
        val passNodes = mutableListOf<AccessibilityNodeInfo>()
        collectInputNodes(root, userNodes, passNodes)

        if (passNodes.isNotEmpty()) trackedPasswordNode = passNodes.first()
        if (userNodes.isNotEmpty()) trackedUsernameNode = userNodes.first()
    }

    private fun collectInputNodes(
        node: AccessibilityNodeInfo?,
        userNodes: MutableList<AccessibilityNodeInfo>,
        passNodes: MutableList<AccessibilityNodeInfo>
    ) {
        if (node == null) return

        if (node.isEditable) {
            if (node.isPassword) {
                passNodes.add(node)
            } else {
                val hint = (node.hintText?.toString() ?: "").lowercase()
                val resId = (node.viewIdResourceName ?: "").lowercase()
                val text = (node.text?.toString() ?: "").lowercase()
                val combined = "$hint $resId $text"

                // Exclude search/url/chat fields
                val isExcluded = combined.containsAny(
                    "search", "query", "find", "url", "address", "omnibox",
                    "message", "comment", "composer", "chat"
                )

                if (!isExcluded && combined.containsAny("user", "email", "login", "phone", "account")) {
                    userNodes.add(node)
                }
            }
        }

        for (i in 0 until node.childCount) {
            collectInputNodes(node.getChild(i), userNodes, passNodes)
        }
    }

    /**
     * Called by AutofillSearchActivity or triggerFill() to fill the tracked fields.
     */
    fun performPendingFill() {
        val username = pendingUsername ?: return
        val password = pendingPassword ?: return

        var filled = false

        trackedUsernameNode?.let { node ->
            try {
                val args = Bundle()
                args.putCharSequence(
                    AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                    username
                )
                if (node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)) {
                    Log.d(TAG, "Filled username into $lastPackage")
                    filled = true
                }
            } catch (e: Exception) {
                Log.w(TAG, "Failed to fill username", e)
            }
        }

        trackedPasswordNode?.let { node ->
            try {
                val args = Bundle()
                args.putCharSequence(
                    AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                    password
                )
                if (node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)) {
                    Log.d(TAG, "Filled password into $lastPackage")
                    filled = true
                }
            } catch (e: Exception) {
                Log.w(TAG, "Failed to fill password", e)
            }
        }

        if (filled) {
            pendingUsername = null
            pendingPassword = null
        } else {
            Log.w(TAG, "Could not fill — no tracked fields in $lastPackage")
        }
    }

    private fun String.containsAny(vararg keywords: String): Boolean =
        keywords.any { this.contains(it) }
}
