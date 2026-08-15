package com.vaultr.mobile.autofill

import android.accessibilityservice.AccessibilityService
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.Toast
import java.net.URI

/**
 * VaultrAccessibilityService
 *
 * Provides background tracking and delayed live field injection for Quick Settings autofill.
 */
class VaultrAccessibilityService : AccessibilityService() {

    data class AppContext(
        val packageName: String?,
        val webDomain: String?,
        val isBrowser: Boolean
    )

    data class PendingFill(
        val username: String,
        val password: String,
        val name: String,
        val timestamp: Long = System.currentTimeMillis()
    )

    companion object {
        private const val TAG = "VaultrAccessibility"

        var instance: VaultrAccessibilityService? = null
            private set

        @Volatile
        var currentContext: AppContext = AppContext(null, null, false)
            private set

        @Volatile
        private var pendingFill: PendingFill? = null

        fun isRunning(): Boolean = instance != null

        fun queuePendingFill(context: Context, username: String, password: String, name: String) {
            val service = instance
            if (service == null) {
                // Fallback: copy password to clipboard if service not running
                copyToClipboard(context, "Password", password)
                Toast.makeText(context, "Password copied to clipboard", Toast.LENGTH_SHORT).show()
                return
            }

            pendingFill = PendingFill(username, password, name)
            // Schedule delayed fill attempts as the Quick Settings sheet collapses
            service.scheduleDelayedFills()
        }

        private fun copyToClipboard(context: Context, label: String, value: String) {
            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager ?: return
            clipboard.setPrimaryClip(ClipData.newPlainText(label, value))
        }
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private var lastPackage: String? = null

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
        Log.d(TAG, "Vaultr Accessibility Service connected")
        AutofillCredentialStore.initialize(applicationContext)
    }

    override fun onDestroy() {
        super.onDestroy()
        if (instance === this) instance = null
        mainHandler.removeCallbacksAndMessages(null)
    }

    override fun onInterrupt() {
        Log.d(TAG, "Accessibility service interrupted")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        val pkg = event.packageName?.toString() ?: return
        if (pkg == this.packageName) return // Ignore Vaultr's own UI events

        when (event.eventType) {
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED,
            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED,
            AccessibilityEvent.TYPE_VIEW_FOCUSED -> {
                lastPackage = pkg
                val isBrowser = BROWSER_PACKAGES.contains(pkg)

                val root = rootInActiveWindow
                var domain: String? = null
                if (isBrowser && root != null) {
                    domain = extractBrowserDomain(root)
                }

                currentContext = AppContext(
                    packageName = pkg,
                    webDomain = domain,
                    isBrowser = isBrowser
                )

                // If a fill is pending and we are back in the target app, execute it immediately
                if (pendingFill != null) {
                    executeFillSequence()
                }
            }
        }
    }

    fun scheduleDelayedFills() {
        // Run retry passes at 100ms, 250ms, 450ms, 700ms to catch window transition
        val delays = listOf(100L, 250L, 450L, 700L)
        for (d in delays) {
            mainHandler.postDelayed({
                if (pendingFill != null) {
                    executeFillSequence()
                }
            }, d)
        }
    }

    private fun executeFillSequence(): Boolean {
        val fill = pendingFill ?: return false

        // Discard expired pending fill (>5 seconds old)
        if (System.currentTimeMillis() - fill.timestamp > 5000) {
            pendingFill = null
            return false
        }

        val root = rootInActiveWindow ?: return false
        val userNodes = mutableListOf<AccessibilityNodeInfo>()
        val passNodes = mutableListOf<AccessibilityNodeInfo>()

        collectInputNodes(root, userNodes, passNodes)

        if (userNodes.isEmpty() && passNodes.isEmpty()) {
            return false
        }

        var filledAny = false

        // 1. Fill Password Node
        if (passNodes.isNotEmpty() && fill.password.isNotEmpty()) {
            val pNode = passNodes.first()
            if (injectText(pNode, fill.password)) {
                filledAny = true
            }
        }

        // 2. Fill Username Node
        if (userNodes.isNotEmpty() && fill.username.isNotEmpty()) {
            val uNode = userNodes.first()
            if (injectText(uNode, fill.username)) {
                filledAny = true
            }
        }

        if (filledAny) {
            pendingFill = null
            mainHandler.post {
                Toast.makeText(applicationContext, "✨ Autofilled ${fill.name}", Toast.LENGTH_SHORT).show()
            }
            return true
        }

        return false
    }

    private fun injectText(node: AccessibilityNodeInfo, text: String): Boolean {
        return try {
            // Focus the node first
            node.performAction(AccessibilityNodeInfo.ACTION_FOCUS)

            // Primary method: ACTION_SET_TEXT
            val args = Bundle().apply {
                putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
            }
            val success = node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
            if (success) return true

            // Fallback method: ACTION_PASTE via clipboard
            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
            if (clipboard != null) {
                clipboard.setPrimaryClip(ClipData.newPlainText("fill", text))
                node.performAction(AccessibilityNodeInfo.ACTION_PASTE)
            } else {
                false
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error injecting text into node", e)
            false
        }
    }

    private fun collectInputNodes(
        node: AccessibilityNodeInfo?,
        userNodes: MutableList<AccessibilityNodeInfo>,
        passNodes: MutableList<AccessibilityNodeInfo>
    ) {
        if (node == null) return

        if (node.isEditable) {
            val hint = (node.hintText?.toString() ?: "").lowercase()
            val resId = (node.viewIdResourceName ?: "").lowercase()
            val text = (node.text?.toString() ?: "").lowercase()
            val combined = "$hint $resId $text"

            val isExcluded = combined.containsAny(
                "search", "query", "find", "url", "address", "omnibox",
                "message", "comment", "composer", "chat", "terminal"
            )

            if (!isExcluded) {
                if (node.isPassword || combined.containsAny("password", "passcode", "pin", "pass", "secret")) {
                    passNodes.add(node)
                } else if (combined.containsAny("user", "email", "login", "phone", "account", "id", "uname") || userNodes.isEmpty()) {
                    userNodes.add(node)
                }
            }
        }

        for (i in 0 until node.childCount) {
            collectInputNodes(node.getChild(i), userNodes, passNodes)
        }
    }

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

    private fun String.containsAny(vararg keywords: String): Boolean =
        keywords.any { this.contains(it) }
}
