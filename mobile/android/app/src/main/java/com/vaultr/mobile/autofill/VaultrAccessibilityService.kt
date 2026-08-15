package com.vaultr.mobile.autofill

import android.accessibilityservice.AccessibilityService
import android.os.Bundle
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import java.net.URI

/**
 * VaultrAccessibilityService
 *
 * Provides deep autofill integration for the Quick Settings pull-down shade:
 *  1. CONTEXT AWARE: Automatically tracks foreground app package name and
 *     extracts current website domain from Chrome, Brave, Samsung Internet, Firefox, Edge, etc.
 *  2. LIVE FILL: When user taps "Autofill" in Quick Settings search sheet,
 *     directly injects credentials into the active app's input fields via ACTION_SET_TEXT.
 */
class VaultrAccessibilityService : AccessibilityService() {

    data class AppContext(
        val packageName: String?,
        val webDomain: String?,
        val isBrowser: Boolean
    )

    companion object {
        private const val TAG = "VaultrAccessibility"

        var instance: VaultrAccessibilityService? = null
            private set

        @Volatile
        var currentContext: AppContext = AppContext(null, null, false)
            private set

        @Volatile
        private var pendingUsername: String? = null
        @Volatile
        private var pendingPassword: String? = null

        fun isRunning(): Boolean = instance != null

        fun triggerFill(username: String, password: String): Boolean {
            val service = instance ?: return false
            pendingUsername = username
            pendingPassword = password
            return service.performPendingFill()
        }
    }

    private var trackedUsernameNode: AccessibilityNodeInfo? = null
    private var trackedPasswordNode: AccessibilityNodeInfo? = null
    private var lastPackage: String? = null

    // Known browser packages
    private val BROWSER_PACKAGES = setOf(
        "com.android.chrome",
        "com.brave.browser",
        "com.sec.android.app.sbrowser",
        "org.mozilla.firefox",
        "com.microsoft.emmx",
        "com.opera.browser",
        "com.opera.mini.native",
        "com.vivaldi.browser",
        "com.duckduckgo.mobile.android"
    )

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        Log.d(TAG, "Vaultr Accessibility Autofill Service connected")
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
        if (pkg == this.packageName) return // Ignore events from Vaultr itself

        when (event.eventType) {
            AccessibilityEvent.TYPE_VIEW_FOCUSED,
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED,
            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> {
                try {
                    val root = rootInActiveWindow ?: return
                    val isBrowser = BROWSER_PACKAGES.contains(pkg)

                    if (lastPackage != pkg) {
                        trackedUsernameNode = null
                        trackedPasswordNode = null
                        lastPackage = pkg
                    }

                    var domain: String? = null
                    if (isBrowser) {
                        domain = extractBrowserDomain(root)
                    }

                    currentContext = AppContext(
                        packageName = pkg,
                        webDomain = domain,
                        isBrowser = isBrowser
                    )

                    scanAndTrackNodes(root)
                } catch (e: Exception) {
                    Log.w(TAG, "Error scanning accessibility nodes", e)
                }
            }
        }
    }

    /**
     * Extracts active website domain from browser URL bars.
     */
    private fun extractBrowserDomain(root: AccessibilityNodeInfo): String? {
        val urlNodes = mutableListOf<AccessibilityNodeInfo>()
        findBrowserUrlNodes(root, urlNodes)

        for (node in urlNodes) {
            val text = (node.text?.toString() ?: node.contentDescription?.toString() ?: "").trim()
            if (text.isNotEmpty()) {
                val clean = cleanDomain(text)
                if (clean != null && clean.contains(".")) {
                    return clean
                }
            }
        }
        return null
    }

    private fun findBrowserUrlNodes(node: AccessibilityNodeInfo?, outList: MutableList<AccessibilityNodeInfo>) {
        if (node == null) return

        val resId = (node.viewIdResourceName ?: "").lowercase()
        if (resId.contains("url_bar") || resId.contains("location_bar") || resId.contains("search_box_text") || resId.contains("mozac_browser_toolbar")) {
            outList.add(node)
        }

        for (i in 0 until node.childCount) {
            findBrowserUrlNodes(node.getChild(i), outList)
        }
    }

    private fun cleanDomain(raw: String): String? {
        var str = raw.trim()
        if (!str.startsWith("http://") && !str.startsWith("https://")) {
            str = "https://$str"
        }
        return try {
            val uri = URI(str)
            val host = uri.host ?: return null
            host.removePrefix("www.")
        } catch (_: Exception) {
            null
        }
    }

    /**
     * Walk the node tree to identify username and password fields.
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

                val isExcluded = combined.containsAny(
                    "search", "query", "find", "url", "address", "omnibox",
                    "message", "comment", "composer", "chat", "terminal"
                )

                if (!isExcluded && (combined.containsAny("user", "email", "login", "phone", "account", "id") || userNodes.isEmpty())) {
                    userNodes.add(node)
                }
            }
        }

        for (i in 0 until node.childCount) {
            collectInputNodes(node.getChild(i), userNodes, passNodes)
        }
    }

    /**
     * Injects the credentials directly into the fields of the active app.
     */
    fun performPendingFill(): Boolean {
        val username = pendingUsername ?: return false
        val password = pendingPassword ?: return false

        var filled = false

        // 1. Try currently tracked nodes
        trackedUsernameNode?.let { node ->
            if (setTextOnNode(node, username)) {
                Log.d(TAG, "Filled username into tracked node")
                filled = true
            }
        }

        trackedPasswordNode?.let { node ->
            if (setTextOnNode(node, password)) {
                Log.d(TAG, "Filled password into tracked node")
                filled = true
            }
        }

        // 2. If tracked nodes were stale / detached, rescan rootInActiveWindow
        if (!filled) {
            val root = rootInActiveWindow
            if (root != null) {
                val userNodes = mutableListOf<AccessibilityNodeInfo>()
                val passNodes = mutableListOf<AccessibilityNodeInfo>()
                collectInputNodes(root, userNodes, passNodes)

                userNodes.firstOrNull()?.let {
                    if (setTextOnNode(it, username)) filled = true
                }
                passNodes.firstOrNull()?.let {
                    if (setTextOnNode(it, password)) filled = true
                }
            }
        }

        if (filled) {
            pendingUsername = null
            pendingPassword = null
        }

        return filled
    }

    private fun setTextOnNode(node: AccessibilityNodeInfo, text: String): Boolean {
        return try {
            val args = Bundle().apply {
                putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
            }
            node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to perform ACTION_SET_TEXT on node", e)
            false
        }
    }

    private fun String.containsAny(vararg keywords: String): Boolean =
        keywords.any { this.contains(it) }
}
