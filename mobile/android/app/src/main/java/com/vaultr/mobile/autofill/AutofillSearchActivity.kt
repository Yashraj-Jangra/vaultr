package com.vaultr.mobile.autofill

import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.BaseAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.ListView
import android.widget.TextView
import android.widget.Toast
import com.vaultr.mobile.MainActivity
import com.vaultr.mobile.R

/**
 * AutofillSearchActivity — Launched from the Quick Settings Pull-Down Shade Tile.
 *
 * Features:
 *  1. Automatic page/app detection: Checks foreground domain/app from AccessibilityService
 *     and highlights matching logins at the top under "SUGGESTED FOR THIS PAGE".
 *  2. 1-Tap Fill: Direct text injection into active input fields via ACTION_SET_TEXT.
 *  3. Search & filter: Real-time search across all vault accounts.
 *  4. Copy fallbacks: Quick copy buttons with auto-clearing clipboard.
 */
class AutofillSearchActivity : Activity() {

    private lateinit var searchInput: EditText
    private lateinit var clearBtn: ImageButton
    private lateinit var closeBtn: ImageButton
    private lateinit var resultsList: ListView
    private lateinit var statusText: TextView
    private lateinit var sectionHeader: TextView
    private lateinit var textDetectedContext: TextView
    private lateinit var containerSuggestedBadge: LinearLayout
    private lateinit var textSuggestedTarget: TextView
    private lateinit var textAccessibilityStatus: TextView
    private lateinit var btnEnableAccessibility: Button

    private var allItems: List<AutofillItem> = emptyList()
    private var suggestedItems: List<AutofillItem> = emptyList()
    private var displayItems: MutableList<AutofillItem> = mutableListOf()
    private lateinit var adapter: SearchAdapter

    private var activeTarget: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_autofill_search)

        AutofillCredentialStore.initialize(applicationContext)
        allItems = AutofillCredentialStore.getAll()

        initViews()
        detectCurrentContext()
        setupListeners()
        updateAccessibilityState()
    }

    override fun onResume() {
        super.onResume()
        updateAccessibilityState()
    }

    private fun initViews() {
        searchInput = findViewById(R.id.search_edit_text)
        clearBtn = findViewById(R.id.btn_clear_search)
        closeBtn = findViewById(R.id.btn_close_search)
        resultsList = findViewById(R.id.search_results_list)
        statusText = findViewById(R.id.search_status_text)
        sectionHeader = findViewById(R.id.text_section_header)
        textDetectedContext = findViewById(R.id.text_detected_context)
        containerSuggestedBadge = findViewById(R.id.container_suggested_badge)
        textSuggestedTarget = findViewById(R.id.text_suggested_target)
        textAccessibilityStatus = findViewById(R.id.text_accessibility_status)
        btnEnableAccessibility = findViewById(R.id.btn_enable_accessibility)

        adapter = SearchAdapter(
            context = this,
            items = displayItems,
            onFill = { item -> fillIntoActivePage(item) },
            onCopy = { item -> copyToClipboardSecure("Password", item.password) }
        )
        resultsList.adapter = adapter
    }

    private fun detectCurrentContext() {
        val appContext = VaultrAccessibilityService.currentContext
        val target = appContext.webDomain ?: appContext.packageName

        if (!target.isNullOrBlank()) {
            activeTarget = target
            suggestedItems = AutofillCredentialStore.findMatches(target)

            val displayLabel = appContext.webDomain ?: getAppLabel(appContext.packageName)
            containerSuggestedBadge.visibility = View.VISIBLE
            textSuggestedTarget.text = displayLabel
            textDetectedContext.text = "Tap to autofill $displayLabel"

            if (suggestedItems.isNotEmpty()) {
                sectionHeader.text = "SUGGESTED FOR THIS PAGE"
                displayItems.clear()
                displayItems.addAll(suggestedItems)
                // Add remaining non-matching items below
                val remaining = allItems.filter { !suggestedItems.contains(it) }
                displayItems.addAll(remaining)
                adapter.notifyDataSetChanged()
                updateEmptyState()
                return
            }
        } else {
            containerSuggestedBadge.visibility = View.GONE
            textDetectedContext.text = "Tap any account to fill"
        }

        sectionHeader.text = "ALL ACCOUNTS"
        displayItems.clear()
        displayItems.addAll(allItems)
        adapter.notifyDataSetChanged()
        updateEmptyState()
    }

    private fun setupListeners() {
        closeBtn.setOnClickListener { finish() }
        clearBtn.setOnClickListener { searchInput.setText("") }

        btnEnableAccessibility.setOnClickListener {
            try {
                startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                })
            } catch (e: Exception) {
                Toast.makeText(this, "Open Settings → Accessibility → Enable Vaultr", Toast.LENGTH_LONG).show()
            }
        }

        searchInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                val q = s?.toString()?.trim() ?: ""
                clearBtn.visibility = if (q.isNotEmpty()) View.VISIBLE else View.GONE
                filterResults(q)
            }
            override fun afterTextChanged(s: Editable?) {}
        })
    }

    private fun filterResults(query: String) {
        displayItems.clear()
        if (query.isEmpty()) {
            if (suggestedItems.isNotEmpty()) {
                sectionHeader.text = "SUGGESTED FOR THIS PAGE"
                displayItems.addAll(suggestedItems)
                val remaining = allItems.filter { !suggestedItems.contains(it) }
                displayItems.addAll(remaining)
            } else {
                sectionHeader.text = "ALL ACCOUNTS"
                displayItems.addAll(allItems)
            }
        } else {
            sectionHeader.text = "SEARCH RESULTS"
            val q = query.lowercase()
            displayItems.addAll(allItems.filter { item ->
                item.name.lowercase().contains(q) ||
                item.username.lowercase().contains(q) ||
                (item.domain?.lowercase()?.contains(q) == true) ||
                item.urls.any { it.lowercase().contains(q) }
            })
        }
        adapter.notifyDataSetChanged()
        updateEmptyState()
    }

    private fun updateEmptyState() {
        when {
            allItems.isEmpty() -> {
                statusText.visibility = View.VISIBLE
                statusText.text = "Vault is locked or empty.\nTap to open Vaultr."
                statusText.setOnClickListener {
                    startActivity(Intent(this, MainActivity::class.java).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    })
                    finish()
                }
            }
            displayItems.isEmpty() -> {
                statusText.visibility = View.VISIBLE
                statusText.text = "No matching accounts found."
                statusText.setOnClickListener(null)
            }
            else -> {
                statusText.visibility = View.GONE
                statusText.setOnClickListener(null)
            }
        }
    }

    private fun updateAccessibilityState() {
        val isServiceActive = VaultrAccessibilityService.isRunning()
        if (isServiceActive) {
            textAccessibilityStatus.text = "⚡ 1-Tap direct autofill ready"
            textAccessibilityStatus.setTextColor(0xFF10B981.toInt())
            btnEnableAccessibility.visibility = View.GONE
        } else {
            textAccessibilityStatus.text = "⚠️ Enable direct autofill in Settings"
            textAccessibilityStatus.setTextColor(0xFFF59E0B.toInt())
            btnEnableAccessibility.visibility = View.VISIBLE
        }
    }

    private fun fillIntoActivePage(item: AutofillItem) {
        if (VaultrAccessibilityService.isRunning()) {
            VaultrAccessibilityService.queuePendingFill(applicationContext, item.username, item.password, item.name)
            copyToClipboardSecure("Password", item.password)
            finish()
            overridePendingTransition(0, 0)
        } else {
            copyToClipboardSecure("Password", item.password)
            Toast.makeText(
                this,
                "Password copied! Enable Accessibility in Settings for 1-tap direct fill.",
                Toast.LENGTH_LONG
            ).show()
            finish()
            overridePendingTransition(0, 0)
        }
    }

    private fun copyToClipboardSecure(label: String, value: String) {
        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText(label, value))
        Toast.makeText(this, "$label copied", Toast.LENGTH_SHORT).show()
        Handler(Looper.getMainLooper()).postDelayed({
            try {
                if (clipboard.hasPrimaryClip()) {
                    clipboard.setPrimaryClip(ClipData.newPlainText("", ""))
                }
            } catch (_: Exception) {}
        }, 45_000)
    }

    private fun getAppLabel(pkg: String?): String {
        if (pkg == null) return "Current App"
        return try {
            val pm = packageManager
            val info = pm.getApplicationInfo(pkg, 0)
            pm.getApplicationLabel(info).toString()
        } catch (_: Exception) {
            pkg.substringAfterLast('.')
        }
    }

    private class SearchAdapter(
        private val context: Context,
        private val items: List<AutofillItem>,
        private val onFill: (AutofillItem) -> Unit,
        private val onCopy: (AutofillItem) -> Unit
    ) : BaseAdapter() {

        override fun getCount() = items.size
        override fun getItem(pos: Int): Any = items[pos]
        override fun getItemId(pos: Int) = pos.toLong()

        override fun getView(position: Int, convertView: View?, parent: ViewGroup?): View {
            val view = convertView ?: LayoutInflater.from(context)
                .inflate(R.layout.item_autofill_search_row, parent, false)
            val item = items[position]

            val avatarText = view.findViewById<TextView>(R.id.search_item_avatar)
            val title = view.findViewById<TextView>(R.id.search_item_title)
            val subtitle = view.findViewById<TextView>(R.id.search_item_subtitle)
            val btnFill = view.findViewById<Button>(R.id.btn_action_fill)
            val btnCopy = view.findViewById<ImageButton>(R.id.btn_action_copy)

            val initial = item.name.firstOrNull()?.uppercaseChar()?.toString() ?: "V"
            avatarText.text = initial
            title.text = item.name
            subtitle.text = item.username.ifBlank { item.domain ?: "No username" }

            view.setOnClickListener { onFill(item) }
            btnFill.setOnClickListener { onFill(item) }
            btnCopy.setOnClickListener { onCopy(item) }

            return view
        }
    }
}
