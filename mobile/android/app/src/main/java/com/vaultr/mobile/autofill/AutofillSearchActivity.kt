package com.vaultr.mobile.autofill

import android.annotation.SuppressLint
import android.app.Activity
import android.app.assist.AssistStructure
import android.content.BroadcastReceiver
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.TextWatcher
import android.util.Log
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import android.view.autofill.AutofillId
import android.view.autofill.AutofillManager
import android.view.autofill.AutofillValue
import android.widget.BaseAdapter
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ListView
import android.widget.PopupMenu
import android.widget.RemoteViews
import android.widget.TextView
import android.widget.Toast
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.vaultr.mobile.MainActivity
import com.vaultr.mobile.R

/**
 * AutofillSearchActivity — Modern Bottom Sheet Autofill.
 *
 * Displays suggested credentials for the current website/app (or empty state if none found).
 * Full vault search is unlocked instantly via the search bar.
 */
class AutofillSearchActivity : Activity() {

    companion object {
        private const val TAG = "AutofillSearchActivity"
    }

    private lateinit var rootBackdrop: FrameLayout
    private lateinit var sheetContainer: LinearLayout
    private lateinit var searchInput: EditText
    private lateinit var clearBtn: ImageButton
    private lateinit var closeBtn: ImageButton
    private lateinit var resultsList: ListView
    private lateinit var statusText: TextView
    private lateinit var textDetectedContext: TextView
    private lateinit var emptyStateContainer: LinearLayout

    private var isAutofillRequest: Boolean = false
    private var isUnlockRequest: Boolean = false
    private var usernameId: AutofillId? = null
    private var passwordId: AutofillId? = null
    private var currentFocusedId: AutofillId? = null
    private var passedWebDomain: String? = null
    private var passedPackageName: String? = null

    private var allItems: List<AutofillItem> = emptyList()
    private var suggestedItems: List<AutofillItem> = emptyList()
    private var displayItems: MutableList<AutofillItem> = mutableListOf()
    private lateinit var adapter: SearchAdapter

    private val unlockReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (intent.action == VaultrAutofillModule.ACTION_AUTOFILL_UNLOCKED) {
                Log.d(TAG, "Received ACTION_AUTOFILL_UNLOCKED broadcast, reloading vault items")
                runOnUiThread {
                    AutofillCredentialStore.initialize(applicationContext)
                    allItems = AutofillCredentialStore.getAll()
                    detectCurrentContext()
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_autofill_search)

        // Ensure the dialog window fills width and anchors to bottom
        window?.let { win ->
            win.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
            win.setGravity(Gravity.BOTTOM)
        }

        parseIntentExtras()

        AutofillCredentialStore.initialize(applicationContext)
        allItems = AutofillCredentialStore.getAll()

        initViews()
        setupInsets()
        detectCurrentContext()
        setupListeners()
        registerUnlockReceiver()

        // If vault is locked or empty, invoke biometric unlock automatically
        if (AutofillCredentialStore.isVaultLocked() || allItems.isEmpty() || isUnlockRequest) {
            promptVaultUnlock()
        }
    }

    private fun parseIntentExtras() {
        isAutofillRequest = intent.getBooleanExtra("EXTRA_IS_AUTOFILL_REQUEST", false)
        isUnlockRequest = intent.getBooleanExtra("EXTRA_IS_UNLOCK_REQUEST", false)
        passedWebDomain = intent.getStringExtra("EXTRA_WEB_DOMAIN")?.takeIf { it.isNotBlank() }
        passedPackageName = intent.getStringExtra("EXTRA_PACKAGE_NAME")?.takeIf { it.isNotBlank() }

        usernameId = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra("EXTRA_USERNAME_ID", AutofillId::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra("EXTRA_USERNAME_ID")
        }

        passwordId = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra("EXTRA_PASSWORD_ID", AutofillId::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra("EXTRA_PASSWORD_ID")
        }

        // Also parse AssistStructure if provided by the Android Autofill framework
        val structure: AssistStructure? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(AutofillManager.EXTRA_ASSIST_STRUCTURE, AssistStructure::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra(AutofillManager.EXTRA_ASSIST_STRUCTURE)
        }

        if (structure != null) {
            isAutofillRequest = true
            val parsed = StructureParser.parse(structure)
            if (usernameId == null) usernameId = parsed.usernameId
            if (passwordId == null) passwordId = parsed.passwordId
            if (currentFocusedId == null) currentFocusedId = parsed.currentFocusedId
            if (passedWebDomain == null) passedWebDomain = parsed.webDomain
            if (passedPackageName == null) passedPackageName = parsed.packageName
            Log.d(TAG, "Parsed AssistStructure: domain=$passedWebDomain userField=$usernameId passField=$passwordId focused=$currentFocusedId")
        }

        if (usernameId != null || passwordId != null) {
            isAutofillRequest = true
        }

        Log.d(TAG, "Started: isAutofill=$isAutofillRequest isUnlock=$isUnlockRequest domain=$passedWebDomain pkg=$passedPackageName userField=$usernameId passField=$passwordId")
    }

    private fun promptVaultUnlock() {
        VaultrAutofillModule.isAutofillUnlockPending = true
        emptyStateContainer.visibility = View.VISIBLE
        statusText.text = "🔒 Vault is locked\nUnlocking with biometrics…"

        try {
            val unlockIntent = Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("isAutofillUnlock", true)
            }
            startActivity(unlockIntent)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to launch MainActivity for unlock", e)
        }
    }

    @SuppressLint("UnspecifiedRegisterReceiverFlag")
    private fun registerUnlockReceiver() {
        val filter = IntentFilter(VaultrAutofillModule.ACTION_AUTOFILL_UNLOCKED)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(unlockReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(unlockReceiver, filter)
        }
    }

    override fun onResume() {
        super.onResume()
        AutofillCredentialStore.initialize(applicationContext)
        val latest = AutofillCredentialStore.getAll()
        if (latest.isNotEmpty() && (allItems.isEmpty() || latest.size != allItems.size)) {
            allItems = latest
            detectCurrentContext()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            unregisterReceiver(unlockReceiver)
        } catch (_: Exception) {}
    }

    private fun initViews() {
        rootBackdrop = findViewById(R.id.root_backdrop)
        sheetContainer = findViewById(R.id.sheet_container)
        searchInput = findViewById(R.id.search_edit_text)
        clearBtn = findViewById(R.id.btn_clear_search)
        closeBtn = findViewById(R.id.btn_close_search)
        resultsList = findViewById(R.id.search_results_list)
        statusText = findViewById(R.id.search_status_text)
        textDetectedContext = findViewById(R.id.text_detected_context)
        emptyStateContainer = findViewById(R.id.container_empty_state)

        adapter = SearchAdapter(
            context = this,
            items = displayItems,
            onFill = { item -> fillIntoActivePage(item) },
            onCopyUser = { item -> copyToClipboardSecure("Username", item.username) },
            onCopyPass = { item -> copyToClipboardSecure("Password", item.password) }
        )
        resultsList.adapter = adapter
    }

    private fun setupInsets() {
        // Adjust sheet position above the soft keyboard or system navigation bars
        ViewCompat.setOnApplyWindowInsetsListener(rootBackdrop) { _, insets ->
            val imeInsets = insets.getInsets(WindowInsetsCompat.Type.ime())
            val navInsets = insets.getInsets(WindowInsetsCompat.Type.navigationBars())

            val bottomMargin = if (imeInsets.bottom > 0) imeInsets.bottom else navInsets.bottom
            val lp = sheetContainer.layoutParams as? FrameLayout.LayoutParams
            if (lp != null && lp.bottomMargin != bottomMargin) {
                lp.bottomMargin = bottomMargin
                sheetContainer.layoutParams = lp
            }

            // Dynamically cap max height when keyboard is open
            val displayMetrics = resources.displayMetrics
            val availableHeight = displayMetrics.heightPixels - bottomMargin - insets.getInsets(WindowInsetsCompat.Type.statusBars()).top
            val maxHeight = if (imeInsets.bottom > 0) (availableHeight * 0.85).toInt() else (displayMetrics.heightPixels * 0.75).toInt()

            resultsList.layoutParams?.let { listLp ->
                val calculatedListMax = maxHeight - (140 * displayMetrics.density).toInt()
                if (calculatedListMax > 0 && resultsList.height > calculatedListMax) {
                    listLp.height = calculatedListMax
                    resultsList.layoutParams = listLp
                }
            }

            insets
        }
    }

    private fun detectCurrentContext() {
        if (AutofillCredentialStore.isVaultLocked() || allItems.isEmpty()) {
            displayItems.clear()
            adapter.notifyDataSetChanged()
            updateEmptyState()
            return
        }

        // Determine context target: prioritize Intent extras, fallback to accessibility service context
        val targetDomain = passedWebDomain ?: VaultrAccessibilityService.currentContext.webDomain
        val targetPkg = passedPackageName ?: VaultrAccessibilityService.currentContext.packageName

        val target = targetDomain ?: targetPkg

        if (!target.isNullOrBlank()) {
            suggestedItems = AutofillCredentialStore.findMatches(target)
            val displayLabel = targetDomain ?: getAppLabel(targetPkg)

            if (suggestedItems.isNotEmpty()) {
                textDetectedContext.text = "📍 Suggested for $displayLabel (${suggestedItems.size})"
                textDetectedContext.setTextColor(0xFFF59E0B.toInt()) // Amber highlight
                displayItems.clear()
                // ONLY show suggested items by default!
                displayItems.addAll(suggestedItems)
                adapter.notifyDataSetChanged()
                updateEmptyState()
                return
            } else {
                // Found none -> show empty list with prompt to search
                textDetectedContext.text = "📍 $displayLabel"
                textDetectedContext.setTextColor(0xFFA1A1AA.toInt())
                displayItems.clear()
                adapter.notifyDataSetChanged()
                updateEmptyState(targetLabel = displayLabel)
                return
            }
        } else {
            textDetectedContext.text = "Search all accounts in vault"
            textDetectedContext.setTextColor(0xFFA1A1AA.toInt())
        }

        displayItems.clear()
        displayItems.addAll(allItems)
        adapter.notifyDataSetChanged()
        updateEmptyState()
    }

    private fun setupListeners() {
        // Tapping backdrop dismisses the bottom sheet
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
            // Restore context suggestions or empty state
            detectCurrentContext()
            return
        }

        // When searching, search across ALL items in the vault!
        val q = query.lowercase()
        val filtered = allItems.filter { item ->
            item.name.lowercase().contains(q) ||
            item.username.lowercase().contains(q) ||
            (item.domain?.lowercase()?.contains(q) == true) ||
            item.urls.any { it.lowercase().contains(q) }
        }
        displayItems.addAll(filtered)
        textDetectedContext.text = "Results for \"$query\" (${filtered.size})"
        textDetectedContext.setTextColor(0xFFA1A1AA.toInt())

        adapter.notifyDataSetChanged()
        updateEmptyState(query = query)
    }

    private fun updateEmptyState(targetLabel: String? = null, query: String? = null) {
        when {
            AutofillCredentialStore.isVaultLocked() || allItems.isEmpty() -> {
                emptyStateContainer.visibility = View.VISIBLE
                statusText.text = "🔒 Vault is locked\nTap to authenticate with biometrics"
                emptyStateContainer.setOnClickListener { promptVaultUnlock() }
            }
            !query.isNullOrEmpty() && displayItems.isEmpty() -> {
                emptyStateContainer.visibility = View.VISIBLE
                statusText.text = "No accounts found matching \"$query\""
                emptyStateContainer.setOnClickListener(null)
            }
            !targetLabel.isNullOrEmpty() && displayItems.isEmpty() -> {
                emptyStateContainer.visibility = View.VISIBLE
                statusText.text = "No saved accounts found for $targetLabel\nSearch above to autofill any other account."
                emptyStateContainer.setOnClickListener(null)
            }
            displayItems.isEmpty() -> {
                emptyStateContainer.visibility = View.VISIBLE
                statusText.text = "No accounts found in your vault."
                emptyStateContainer.setOnClickListener(null)
            }
            else -> {
                emptyStateContainer.visibility = View.GONE
                emptyStateContainer.setOnClickListener(null)
            }
        }
    }

    private fun fillIntoActivePage(item: AutofillItem) {
        Log.d(TAG, "fillIntoActivePage for ${item.name}: isAutofill=$isAutofillRequest uId=$usernameId pId=$passwordId focused=$currentFocusedId")

        // 1. Android Native Autofill Authentication Result
        if (isAutofillRequest || usernameId != null || passwordId != null || currentFocusedId != null) {
            val dataset = buildDatasetForAuthResult(item)
            if (dataset != null) {
                val replyIntent = Intent().apply {
                    putExtra(AutofillManager.EXTRA_AUTHENTICATION_RESULT, dataset)
                }
                setResult(Activity.RESULT_OK, replyIntent)
                Log.d(TAG, "Returned RESULT_OK with Autofill Dataset for ${item.name}")
                dismissSheet()
                return
            } else {
                Log.w(TAG, "buildDatasetForAuthResult returned null")
            }
        }

        // 2. Accessibility or QS Tile fallback
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

    private fun buildDatasetForAuthResult(item: AutofillItem): android.service.autofill.Dataset? {
        val uId = usernameId
        val pId = passwordId
        val fId = currentFocusedId

        if (uId == null && pId == null && fId == null) {
            Log.e(TAG, "Cannot build auth dataset: no AutofillIds available")
            return null
        }

        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                val menuView = RemoteViews(packageName, R.layout.autofill_dataset_item).also {
                    it.setTextViewText(R.id.autofill_item_title, item.name)
                    it.setTextViewText(R.id.autofill_item_subtitle, item.username.ifBlank { "Password only" })
                }
                val pres = android.service.autofill.Presentations.Builder()
                    .setMenuPresentation(menuView)
                    .build()
                val datasetBuilder = android.service.autofill.Dataset.Builder(pres)

                if (uId != null) {
                    val field = android.service.autofill.Field.Builder()
                        .setValue(AutofillValue.forText(item.username))
                        .setPresentations(pres)
                        .build()
                    datasetBuilder.setField(uId, field)
                }
                if (pId != null) {
                    val field = android.service.autofill.Field.Builder()
                        .setValue(AutofillValue.forText(item.password))
                        .setPresentations(pres)
                        .build()
                    datasetBuilder.setField(pId, field)
                }
                if (uId == null && pId == null && fId != null) {
                    val field = android.service.autofill.Field.Builder()
                        .setValue(AutofillValue.forText(item.password.ifBlank { item.username }))
                        .setPresentations(pres)
                        .build()
                    datasetBuilder.setField(fId, field)
                }
                datasetBuilder.build()
            } else {
                @Suppress("DEPRECATION")
                val builder = android.service.autofill.Dataset.Builder()
                val dummyView = RemoteViews(packageName, R.layout.autofill_dataset_item).also {
                    it.setTextViewText(R.id.autofill_item_title, item.name)
                    it.setTextViewText(R.id.autofill_item_subtitle, item.username.ifBlank { "Password only" })
                }
                if (uId != null) {
                    builder.setValue(uId, AutofillValue.forText(item.username), dummyView)
                }
                if (pId != null) {
                    builder.setValue(pId, AutofillValue.forText(item.password), dummyView)
                }
                if (uId == null && pId == null && fId != null) {
                    builder.setValue(fId, AutofillValue.forText(item.password.ifBlank { item.username }), dummyView)
                }
                builder.build()
            }
        } catch (e: Exception) {
            Log.e(TAG, "buildDatasetForAuthResult failed", e)
            null
        }
    }

    private fun dismissSheet() {
        finish()
        overridePendingTransition(0, R.anim.slide_out_bottom)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        dismissSheet()
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

            val iconView = view.findViewById<ImageView>(R.id.search_item_icon)
            val avatarText = view.findViewById<TextView>(R.id.search_item_avatar)
            val title = view.findViewById<TextView>(R.id.search_item_title)
            val subtitle = view.findViewById<TextView>(R.id.search_item_subtitle)
            val btnOverflow = view.findViewById<ImageButton>(R.id.btn_item_overflow)

            val initial = item.name.firstOrNull()?.uppercaseChar()?.toString() ?: "V"
            title.text = item.name
            subtitle.text = item.username.ifBlank { item.domain ?: "Password only" }

            // Async Favicon resolution with letter monogram fallback
            val targetDomain = item.domain ?: item.urls.firstOrNull()
            FaviconLoader.loadFavicon(context, targetDomain, iconView, avatarText, initial)

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
