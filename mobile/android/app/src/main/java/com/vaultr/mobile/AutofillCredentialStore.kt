package com.vaultr.mobile

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray

data class Credential(
    val id: String,
    val name: String,
    val username: String,
    val password: String,
    val domain: String?
)

class AutofillCredentialStore(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("vaultr_autofill_credentials", Context.MODE_PRIVATE)

    fun saveCredentials(jsonString: String) {
        prefs.edit().putString("credentials_json", jsonString).apply()
    }

    fun getCredentials(): List<Credential> {
        val jsonString = prefs.getString("credentials_json", null) ?: return emptyList()
        val list = mutableListOf<Credential>()
        try {
            val array = JSONArray(jsonString)
            for (i in 0 until array.length()) {
                val obj = array.getJSONObject(i)
                list.add(
                    Credential(
                        id = obj.optString("id", ""),
                        name = obj.optString("name", ""),
                        username = obj.optString("username", ""),
                        password = obj.optString("password", ""),
                        domain = obj.optString("domain", null)
                    )
                )
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return list
    }

    fun getCredentialsForDomain(domainOrPackage: String): List<Credential> {
        val all = getCredentials()
        if (domainOrPackage.isEmpty()) return all
        val query = domainOrPackage.lowercase()
        return all.filter { cred ->
            val d = (cred.domain ?: "").lowercase()
            d.isNotEmpty() && (d.contains(query) || query.contains(d))
        }
    }
}
