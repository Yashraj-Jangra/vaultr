package com.vaultr.mobile.autofill

import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.BaseAdapter
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.ListView
import android.widget.PopupMenu
import android.widget.TextView
import android.widget.Toast
import com.vaultr.mobile.MainActivity
import com.vaultr.mobile.R

/**
 * AutofillSearchActivity — Minimal, sleek Quick Settings Autofill Sheet.
 *
 * UX:
 *  - 1-Tap on any account row: Directly autofills credentials into the active page/app.
 *  - 3-Dot menu: Copy Username, Copy Password, or Autofill.
 *  - Tap backdrop: Closes the sheet and returns immediately to the previous app.
 */
class AutofillSearchActivity : Activity() {

    private lateinit var rootBackdrop: FrameLayout
    private lateinit var searchInput: EditText
    private lateinit var clearBtn: ImageButton
    private lateinit var closeBtn: ImageButton
    private lateinit var resultsList: ListView
    private lateinit var statusText: TextView
    private lateinit var textDetectedContext: TextView

    private var allItems: List<AutofillItem> = emptyList()
    private var suggestedItems: List<AutofillItem> = emptyList()
    private var displayItems: MutableList<AutofillItem> = mutableListOf()
    private lateinit var adapter: SearchAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_autofill_search)

        AutofillCredentialStore.initialize(applicationContext)
        allItems = AutofillCredentialStore.getAll()

        initViews()
        detectCurrentContext()
        setupListeners()
    }

    private fun initViews() {
        rootBackdrop = findViewById(R.id.root_backdrop)
        searchInput = findViewById(R.id.search_edit_text)
        clearBtn = findViewById(R.id.btn_clear_search)
        closeBtn = findViewById(R.id.btn_close_search)
        resultsList = findViewById(R.id.search_results_list)
        statusText = findViewById(R.id.search_status_text)
        textDetectedContext = findViewById(R.id.text_detected_context)

        adapter = SearchAdapter(
            context = this,
            items = displayItems,
            onFill = { item -> fillIntoActivePage(item) },
            onCopyUser = { item -> copyToClipboardSecure("Username", item.username) },
            onCopyPass = { item -> copyToClipboardSecure("Password", item.password) }
        )
        resultsList.adapter = adapter
    }

    private fun detectCurrentContext() {
        val appContext = VaultrAccessibilityService.currentContext
        val target = appContext.webDomain ?: appContext.packageName

        if (!target.isNullOrBlank()) {
            suggestedItems = AutofillCredentialStore.findMatches(target)
            val displayLabel = appContext.webDomain ?: getAppLabel(appContext.packageName)

            if (suggestedItems.isNotEmpty()) {
                textDetectedContext.text = "📍 Suggested for $displayLabel"
                textDetectedContext.setTextColor(0xFFF59E0B.toInt()) // Amber highlight
                displayItems.clear()
                displayItems.addAll(suggestedItems)
                val remaining = allItems.filter { !suggestedItems.contains(it) }
                displayItems.addAll(remaining)
                adapter.notifyDataSetChanged()
                updateEmptyState()
                return
            } else {
                textDetectedContext.text = "On screen: $displayLabel"
                textDetectedContext.setTextColor(0xFF71717A.toInt())
            }
        } else {
            textDetectedContext.text = "Tap any account to autofill"
            textDetectedContext.setTextColor(0xFF71717A.toInt())
        }

        displayItems.clear()
        displayItems.addAll(allItems)
        adapter.notifyDataSetChanged()
        updateEmptyState()
    }

    private fun setupListeners() {
        // Tapping backdrop dismisses the dialog
        rootBackdrop.setOnClickListener { dismissSheet() }
        closeBtn.setOnClickListener { dismissSheet() }
        clearBtn.setOnClickListener { searchInput.setText("") }

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
                displayItems.addAll(suggestedItems)
                val remaining = allItems.filter { !suggestedItems.contains(it) }
                displayItems.addAll(remaining)
            } else {
                displayItems.addAll(allItems)
            }
        } else {
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
                    dismissSheet()
                }
            }
            displayItems.isEmpty() -> {
                statusText.visibility = View.VISIBLE
                statusText.text = "No matching credentials found."
                statusText.setOnClickListener(null)
            }
            else -> {
                statusText.visibility = View.GONE
                statusText.setOnClickListener(null)
            }
        }
    }

    private fun fillIntoActivePage(item: AutofillItem) {
        if (VaultrAccessibilityService.isRunning()) {
            VaultrAccessibilityService.queuePendingFill(applicationContext, item.username, item.password, item.name)
            copyToClipboardSecure("Password", item.password)
            dismissSheet()
        } else {
            copyToClipboardSecure("Password", item.password)
            Toast.makeText(
                this,
                "Password copied! Enable Accessibility in Settings for direct fill.",
                Toast.LENGTH_LONG
            ).show()
            dismissSheet()
        }
    }

    private fun dismissSheet() {
        finish()
        overridePendingTransition(0, 0)
    }

    private fun copyToClipboardSecure(label: String, value: String) {
        if (value.isBlank()) {
            Toast.makeText(this, "No $label saved", Toast.LENGTH_SHORT).show()
            return
        }
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
        private val onCopyUser: (AutofillItem) -> Unit,
        private val onCopyPass: (AutofillItem) -> Unit
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
            val btnOverflow = view.findViewById<ImageButton>(R.id.btn_item_overflow)

            val initial = item.name.firstOrNull()?.uppercaseChar()?.toString() ?: "V"
            avatarText.text = initial
            title.text = item.name
            subtitle.text = item.username.ifBlank { item.domain ?: "Password only" }

            // 1-Tap on row: autofills
            view.setOnClickListener { onFill(item) }

            // 3-Dot menu: Copy options
            btnOverflow.setOnClickListener { v ->
                showPopupMenu(v, item)
            }

            return view
        }

        private fun showPopupMenu(anchor: View, item: AutofillItem) {
            val popup = PopupMenu(context, anchor)
            popup.menuInflater.inflate(R.menu.menu_autofill_item, popup.menu)
            popup.setOnMenuItemClickListener { menuItem ->
                when (menuItem.itemId) {
                    R.id.action_autofill -> {
                        onFill(item)
                        true
                    }
                    R.id.action_copy_user -> {
                        onCopyUser(item)
                        true
                    }
                    R.id.action_copy_pass -> {
                        onCopyPass(item)
                        true
                    }
                    else -> false
                }
            }
            popup.show()
        }
    }
}
