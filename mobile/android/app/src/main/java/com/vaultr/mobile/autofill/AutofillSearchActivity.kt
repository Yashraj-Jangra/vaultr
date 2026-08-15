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

        clearBtn.setOnClickListener {
            searchInput.setText("")
        }

        filteredItems.addAll(allItems)
        adapter = SearchAdapter(this, filteredItems) { item, copyPassword ->
            if (copyPassword) {
                copyToClipboardSecure("Password", item.password)
            } else {
                copyToClipboardSecure("Username", item.username)
            }
            finish()
        }
        resultsList.adapter = adapter

        updateEmptyState()

        searchInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                val query = s?.toString()?.trim() ?: ""
                clearBtn.visibility = if (query.isNotEmpty()) View.VISIBLE else View.GONE
                filterResults(query)
            }
            override fun afterTextChanged(s: Editable?) {}
        })
    }

    private fun filterResults(query: String) {
        filteredItems.clear()
        if (query.isEmpty()) {
            filteredItems.addAll(allItems)
        } else {
            val q = query.lowercase()
            for (item in allItems) {
                if (item.name.lowercase().contains(q) ||
                    item.username.lowercase().contains(q) ||
                    (item.domain?.lowercase()?.contains(q) == true) ||
                    item.urls.any { it.lowercase().contains(q) }
                ) {
                    filteredItems.add(item)
                }
            }
        }
        adapter.notifyDataSetChanged()
        updateEmptyState()
    }

    private fun updateEmptyState() {
        if (allItems.isEmpty()) {
            statusText.visibility = View.VISIBLE
            statusText.text = "Vault is locked.\nTap here to unlock Vaultr."
            statusText.setOnClickListener {
                val intent = Intent(this, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                startActivity(intent)
                finish()
            }
        } else if (filteredItems.isEmpty()) {
            statusText.visibility = View.VISIBLE
            statusText.text = "No matching accounts found."
            statusText.setOnClickListener(null)
        } else {
            statusText.visibility = View.GONE
        }
    }

    private fun copyToClipboardSecure(label: String, value: String) {
        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val clip = ClipData.newPlainText(label, value)
        clipboard.setPrimaryClip(clip)
        Toast.makeText(this, "$label copied! Auto-clearing in 45s...", Toast.LENGTH_SHORT).show()

        // 45-second auto-clear timer
        Handler(Looper.getMainLooper()).postDelayed({
            try {
                if (clipboard.hasPrimaryClip()) {
                    clipboard.setPrimaryClip(ClipData.newPlainText("", ""))
                }
            } catch (_: Exception) {}
        }, 45000)
    }

    private class SearchAdapter(
        private val context: Context,
        private val items: List<AutofillItem>,
        private val onAction: (AutofillItem, Boolean) -> Unit
    ) : BaseAdapter() {

        override fun getCount(): Int = items.size
        override fun getItem(position: Int): Any = items[position]
        override fun getItemId(position: Int): Long = position.toLong()

        override fun getView(position: Int, convertView: View?, parent: ViewGroup?): View {
            val view = convertView ?: LayoutInflater.from(context).inflate(R.layout.item_autofill_search_row, parent, false)
            val item = items[position]

            val titleView = view.findViewById<TextView>(R.id.search_item_title)
            val subtitleView = view.findViewById<TextView>(R.id.search_item_subtitle)
            val btnUser = view.findViewById<Button>(R.id.btn_copy_user)
            val btnPass = view.findViewById<Button>(R.id.btn_copy_pass)

            titleView.text = item.name
            subtitleView.text = item.username.ifBlank { item.domain ?: "No username" }

            btnUser.setOnClickListener { onAction(item, false) }
            btnPass.setOnClickListener { onAction(item, true) }
            view.setOnClickListener { onAction(item, true) }

            return view
        }
    }
}
