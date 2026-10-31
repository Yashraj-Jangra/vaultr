package com.vaultr.mobile.autofill

import android.accessibilityservice.AccessibilityService
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.TextUtils
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import com.vaultr.mobile.R
import java.net.URI

/**
 * VaultrAccessibilityService
 *
 * Provides background tracking, delayed live field injection, and a floating suggestion
 * overlay for universal autofill in Google sign-in screens, WebViews, and unsupported apps.
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
    private var overlayView: View? = null
    private val windowManager by lazy { getSystemService(Context.WINDOW_SERVICE) as WindowManager }

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
        hideSuggestionOverlay()
        if (instance === this) instance = null
        mainHandler.removeCallbacksAndMessages(null)
    }

    override fun onInterrupt() {
        Log.d(TAG, "Accessibility service interrupted")
        hideSuggestionOverlay()
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        val pkg = event.packageName?.toString() ?: return
        if (pkg == this.packageName) return // Ignore Vaultr's own UI events

        when (event.eventType) {
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

                if (pendingFill != null) {
                    executeFillSequence()
                } else {
                    checkAndShowFieldSuggestion(event, pkg, domain)
                }
            }
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> {
                if (pkg != lastPackage) {
                    hideSuggestionOverlay()
                }
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

                if (pendingFill != null) {
                    executeFillSequence()
                }
            }
            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> {
                if (pendingFill != null) {
                    executeFillSequence()
                }
            }
        }
    }

    private fun checkAndShowFieldSuggestion(event: AccessibilityEvent, pkg: String, domain: String?) {
        val source = event.source ?: rootInActiveWindow?.findFocus(AccessibilityNodeInfo.FOCUS_INPUT) ?: return
        if (!source.isEditable) return

        val hint = (source.hintText?.toString() ?: "").lowercase()
        val resId = (source.viewIdResourceName ?: "").lowercase()
        val text = (source.text?.toString() ?: "").lowercase()
        val desc = (source.contentDescription?.toString() ?: "").lowercase()
        val combined = "$hint $resId $text $desc"

        val isExcluded = combined.containsAny(
            "search", "query", "find", "url", "address", "omnibox",
            "message", "comment", "composer", "chat", "terminal"
        )
        if (isExcluded) {
            hideSuggestionOverlay()
            return
        }

        val isPassword = source.isPassword || combined.containsAny("password", "passcode", "pin", "pass", "secret")
        val isUsername = combined.containsAny("user", "email", "login", "phone", "account", "id", "uname") || isPassword

        if (!isPassword && !isUsername) {
            return
        }

        val target = domain ?: pkg
        AutofillCredentialStore.initialize(applicationContext)
        val hasStored = AutofillCredentialStore.hasStoredCredentials(applicationContext)
        if (!hasStored) return

        val matches = AutofillCredentialStore.findMatches(target).ifEmpty {
            AutofillCredentialStore.findMatchesInStorage(applicationContext, target)
        }
        val match = matches.firstOrNull()

        showSuggestionOverlay(pkg, domain, match)
    }

    private fun showSuggestionOverlay(pkg: String, domain: String?, match: AutofillItem?) {
        hideSuggestionOverlay()

        try {
            val pillLayout = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                val bg = GradientDrawable().apply {
                    shape = GradientDrawable.RECTANGLE
                    cornerRadius = dpToPx(24).toFloat()
                    setColor(0xF018181B.toInt()) // Zinc-900 (94% opacity)
                    setStroke(dpToPx(1), 0xFF3F3F46.toInt()) // Zinc-700 subtle border
                }
                background = bg
                elevation = dpToPx(6).toFloat()
                setPadding(dpToPx(14), dpToPx(8), dpToPx(10), dpToPx(8))
            }

            // 1. VaultR Icon
            val iconView = ImageView(this).apply {
                layoutParams = LinearLayout.LayoutParams(dpToPx(20), dpToPx(20)).apply {
                    marginEnd = dpToPx(8)
                }
                setImageResource(R.drawable.ic_vaultr_lock_small)
            }
            pillLayout.addView(iconView)

            // 2. Suggestion Label
            val labelText = when {
                match != null -> "Autofill ${match.username.ifBlank { match.name }}"
                !domain.isNullOrBlank() -> "Autofill with VaultR"
                else -> "Autofill with VaultR"
            }
            val textView = TextView(this).apply {
                text = labelText
                setTextColor(0xFFF4F4F5.toInt()) // Zinc-100
                textSize = 13.5f
                typeface = Typeface.DEFAULT_BOLD
                maxLines = 1
                ellipsize = TextUtils.TruncateAt.END
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    marginEnd = dpToPx(10)
                }
            }
            pillLayout.addView(textView)

            // 3. Dismiss 'x' button
            val closeBtn = TextView(this).apply {
                text = "✕"
                setTextColor(0xFFA1A1AA.toInt()) // Zinc-400
                textSize = 13f
                setPadding(dpToPx(4), dpToPx(2), dpToPx(4), dpToPx(2))
                setOnClickListener {
                    hideSuggestionOverlay()
                }
            }
            pillLayout.addView(closeBtn)

            // Tapping the pill body opens AutofillSearchActivity directly over the active app
            pillLayout.setOnClickListener {
                val intent = Intent(this@VaultrAccessibilityService, AutofillSearchActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    putExtra("EXTRA_IS_AUTOFILL_REQUEST", true)
                    putExtra("EXTRA_WEB_DOMAIN", domain)
                    putExtra("EXTRA_PACKAGE_NAME", pkg)
                }
                startActivity(intent)
                hideSuggestionOverlay()
            }

            val overlayType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY
            } else {
                @Suppress("DEPRECATION")
                WindowManager.LayoutParams.TYPE_PHONE
            }

            val params = WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                overlayType,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH,
                PixelFormat.TRANSLUCENT
            ).apply {
                gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
                y = dpToPx(96) // Floats above soft keyboard
            }

            windowManager.addView(pillLayout, params)
            overlayView = pillLayout
            Log.d(TAG, "Displayed floating autofill suggestion overlay for $pkg ($domain)")

            // Auto-hide after 12 seconds
            mainHandler.postDelayed({
                if (overlayView === pillLayout) {
                    hideSuggestionOverlay()
                }
            }, 12000)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to show suggestion overlay", e)
        }
    }

    private fun hideSuggestionOverlay() {
        overlayView?.let { view ->
            try {
                windowManager.removeView(view)
            } catch (_: Exception) {}
            overlayView = null
        }
    }

    private fun dpToPx(dp: Int): Int =
        (dp * resources.displayMetrics.density).toInt()

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
            hideSuggestionOverlay()
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
