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
import android.widget.Button
import android.widget.EditText
import android.widget.ImageButton
import android.widget.ListView
import android.widget.TextView
import android.widget.Toast
import com.vaultr.mobile.MainActivity
import com.vaultr.mobile.R

/**
 * AutofillSearchActivity — launched by the Quick Settings Tile.
 *
 * Lets user search their vault, then:
 *  1. AUTOFILL — if Accessibility Service is active, directly fills the last focused
 *     username + password fields in the previous app using ACTION_SET_TEXT.
 *  2. COPY — fallback if Accessibility Service is not granted.
 */
class AutofillSearchActivity : Activity() {

    private lateinit var searchInput: EditText
    private lateinit var clearBtn: ImageButton
    private lateinit var closeBtn: Button
    private lateinit var resultsList: ListView
    private lateinit var statusText: TextView

    private var allItems: List<AutofillItem> = emptyList()
    private var filteredItems: MutableList<AutofillItem> = mutableListOf()
    private lateinit var adapter: SearchAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_autofill_search)

        AutofillCredentialStore.initialize(applicationContext)
        allItems = AutofillCredentialStore.getAll()

        searchInput = findViewById(R.id.search_edit_text)
        clearBtn = findViewById(R.id.btn_clear_search)
        closeBtn = findViewById(R.id.btn_close_search)
        resultsList = findViewById(R.id.search_results_list)
        statusText = findViewById(R.id.search_status_text)

        closeBtn.setOnClickListener { finish() }
        clearBtn.setOnClickListener { searchInput.setText("") }

        filteredItems.addAll(allItems)

        val accessibilityAvailable = VaultrAccessibilityService.instance != null

        adapter = SearchAdapter(
            context = this,
            items = filteredItems,
            accessibilityAvailable = accessibilityAvailable
        ) { item, action ->
            when (action) {
                ItemAction.AUTOFILL -> handleAutofill(item)
                ItemAction.COPY_USER -> copyToClipboardSecure("Username", item.username)
                ItemAction.COPY_PASS -> copyToClipboardSecure("Password", item.password)
            }
        }
        resultsList.adapter = adapter

        updateEmptyState()

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

    private fun handleAutofill(item: AutofillItem) {
        val accessibilityService = VaultrAccessibilityService.instance
        if (accessibilityService != null) {
            // Accessibility Service is active → directly fill the previous app's fields
            VaultrAccessibilityService.triggerFill(item.username, item.password)
            Toast.makeText(this, "Filling ${item.name} into app...", Toast.LENGTH_SHORT).show()
            finish()
        } else {
            // Fallback — accessibility not granted, copy password and show guidance
            copyToClipboardSecure("Password", item.password)
            Toast.makeText(
                this,
                "Password copied! Enable Accessibility Service in Settings → Vaultr for direct autofill.",
                Toast.LENGTH_LONG
            ).show()
            finish()
        }
    }

    private fun filterResults(query: String) {
        filteredItems.clear()
        if (query.isEmpty()) {
            filteredItems.addAll(allItems)
        } else {
            val q = query.lowercase()
            filteredItems.addAll(allItems.filter { item ->
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
            filteredItems.isEmpty() -> {
                statusText.visibility = View.VISIBLE
                statusText.text = "No matching accounts."
                statusText.setOnClickListener(null)
            }
            else -> statusText.visibility = View.GONE
        }
    }

    private fun copyToClipboardSecure(label: String, value: String) {
        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText(label, value))
        Toast.makeText(this, "$label copied — clears in 45s", Toast.LENGTH_SHORT).show()
        Handler(Looper.getMainLooper()).postDelayed({
            try {
                if (clipboard.hasPrimaryClip()) {
                    clipboard.setPrimaryClip(ClipData.newPlainText("", ""))
                }
            } catch (_: Exception) {}
        }, 45_000)
    }

    enum class ItemAction { AUTOFILL, COPY_USER, COPY_PASS }

    private class SearchAdapter(
        private val context: Context,
        private val items: List<AutofillItem>,
        private val accessibilityAvailable: Boolean,
        private val onAction: (AutofillItem, ItemAction) -> Unit
    ) : BaseAdapter() {

        override fun getCount() = items.size
        override fun getItem(pos: Int): Any = items[pos]
        override fun getItemId(pos: Int) = pos.toLong()

        override fun getView(position: Int, convertView: View?, parent: ViewGroup?): View {
            val view = convertView ?: LayoutInflater.from(context)
                .inflate(R.layout.item_autofill_search_row, parent, false)
            val item = items[position]

            view.findViewById<TextView>(R.id.search_item_title).text = item.name
            view.findViewById<TextView>(R.id.search_item_subtitle).text =
                item.username.ifBlank { item.domain ?: "" }

            val btnUser = view.findViewById<Button>(R.id.btn_copy_user)
            val btnPass = view.findViewById<Button>(R.id.btn_copy_pass)

            // Main tap = autofill if possible, else copy password
            view.setOnClickListener { onAction(item, ItemAction.AUTOFILL) }

            if (accessibilityAvailable) {
                btnUser.text = "Fill"
                btnPass.text = "Copy"
                btnUser.setOnClickListener { onAction(item, ItemAction.AUTOFILL) }
                btnPass.setOnClickListener { onAction(item, ItemAction.COPY_PASS) }
            } else {
                btnUser.text = "User"
                btnPass.text = "Pass"
                btnUser.setOnClickListener { onAction(item, ItemAction.COPY_USER) }
                btnPass.setOnClickListener { onAction(item, ItemAction.COPY_PASS) }
            }

            return view
        }
    }
}
