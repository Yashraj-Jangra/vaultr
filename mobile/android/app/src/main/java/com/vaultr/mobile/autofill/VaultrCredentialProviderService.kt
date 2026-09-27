package com.vaultr.mobile.autofill

import android.app.PendingIntent
import android.content.Intent
import android.graphics.drawable.Icon
import android.os.Build
import android.os.CancellationSignal
import android.os.OutcomeReceiver
import android.util.Log
import androidx.annotation.RequiresApi
import androidx.credentials.exceptions.ClearCredentialException
import androidx.credentials.exceptions.ClearCredentialUnknownException
import androidx.credentials.exceptions.CreateCredentialException
import androidx.credentials.exceptions.CreateCredentialUnknownException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.GetCredentialUnknownException
import androidx.credentials.provider.AuthenticationAction
import androidx.credentials.provider.BeginCreateCredentialRequest
import androidx.credentials.provider.BeginCreateCredentialResponse
import androidx.credentials.provider.BeginCreatePasswordCredentialRequest
import androidx.credentials.provider.BeginCreatePublicKeyCredentialRequest
import androidx.credentials.provider.BeginGetCredentialRequest
import androidx.credentials.provider.BeginGetCredentialResponse
import androidx.credentials.provider.BeginGetPasswordOption
import androidx.credentials.provider.BeginGetPublicKeyCredentialOption
import androidx.credentials.provider.CreateEntry
import androidx.credentials.provider.CredentialProviderService
import androidx.credentials.provider.PasswordCredentialEntry
import androidx.credentials.provider.ProviderClearCredentialStateRequest
import androidx.credentials.provider.PublicKeyCredentialEntry
import com.vaultr.mobile.MainActivity
import com.vaultr.mobile.R
import org.json.JSONObject

/**
 * VaultR Native Credential Provider Service (Android 14+ / API 34+).
 * Acts as a first-class passkey and password provider within Android Credential Manager,
 * intercepting WebAuthn FIDO2 passkey requests and credential queries alongside Google Password Manager.
 */
@RequiresApi(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
class VaultrCredentialProviderService : CredentialProviderService() {

    companion object {
        private const val TAG = "VaultrCredProvider"
        const val EXTRA_CREDENTIAL_ID = "vaultr_extra_credential_id"
        const val EXTRA_PASSKEY_ID = "vaultr_extra_passkey_id"
        const val EXTRA_RP_ID = "vaultr_extra_rp_id"
        const val EXTRA_REQUEST_JSON = "vaultr_extra_request_json"
        const val EXTRA_CALLING_PACKAGE = "vaultr_extra_calling_package"
        const val EXTRA_USERNAME = "vaultr_extra_username"
        const val EXTRA_PASSWORD = "vaultr_extra_password"
        const val ACTION_PASSKEY_AUTH = "com.vaultr.mobile.PASSKEY_AUTHENTICATE"
        const val ACTION_PASSWORD_AUTH = "com.vaultr.mobile.PASSWORD_AUTHENTICATE"
        const val ACTION_PASSKEY_CREATE = "com.vaultr.mobile.PASSKEY_CREATE"
        const val ACTION_PASSWORD_CREATE = "com.vaultr.mobile.PASSWORD_CREATE"
        const val ACTION_CREDENTIAL_UNLOCK = "com.vaultr.mobile.CREDENTIAL_UNLOCK"
    }

    override fun onCreate() {
        super.onCreate()
        AutofillCredentialStore.initialize(applicationContext)
    }

    override fun onBeginGetCredentialRequest(
        request: BeginGetCredentialRequest,
        cancellationSignal: CancellationSignal,
        callback: OutcomeReceiver<BeginGetCredentialResponse, GetCredentialException>
    ) {
        try {
            AutofillCredentialStore.initialize(applicationContext)
            val callingAppInfo = request.callingAppInfo
            val callingPackage = callingAppInfo?.packageName ?: ""
            val origin = callingAppInfo?.origin ?: ""

            val responseBuilder = BeginGetCredentialResponse.Builder()

            if (AutofillCredentialStore.isVaultLocked()) {
                Log.d(TAG, "Vault locked during onBeginGetCredentialRequest — checking stored credentials")
                var requestedRpId = ""
                var requestedRequestJson = ""
                for (option in request.beginGetCredentialOptions) {
                    if (option is BeginGetPublicKeyCredentialOption) {
                        requestedRequestJson = option.requestJson
                        if (requestedRequestJson.isNotBlank()) {
                            try {
                                val json = JSONObject(requestedRequestJson)
                                requestedRpId = json.optString("rpId")
                                if (requestedRpId.isBlank()) {
                                    requestedRpId = json.optJSONObject("publicKey")?.optString("rpId") ?: ""
                                }
                            } catch (_: Exception) {}
                        }
                    }
                }
                if (requestedRpId.isBlank() && origin.isNotBlank()) {
                    requestedRpId = AutofillCredentialStore.normalizeDomain(origin)
                }
                if (requestedRpId.isBlank()) {
                    requestedRpId = callingPackage
                }

                val target = if (origin.isNotBlank()) origin else callingPackage
                val storedPasskeys = AutofillCredentialStore.findPasskeysInStorage(applicationContext, requestedRpId)
                val storedPasswords = AutofillCredentialStore.findMatchesInStorage(applicationContext, target)
                val hasStored = AutofillCredentialStore.hasStoredCredentials(applicationContext)

                if (storedPasskeys.isNotEmpty() || storedPasswords.isNotEmpty() || (hasStored && requestedRpId.isNotBlank())) {
                    Log.d(TAG, "Found candidates in storage (passkeys: ${storedPasskeys.size}, passwords: ${storedPasswords.size}) — adding Unlock VaultR action")
                    val unlockIntent = Intent(this, PasskeyAuthActivity::class.java).apply {
                        action = ACTION_CREDENTIAL_UNLOCK
                        putExtra(EXTRA_RP_ID, requestedRpId)
                        putExtra(EXTRA_REQUEST_JSON, requestedRequestJson)
                        putExtra(EXTRA_CALLING_PACKAGE, callingPackage)
                    }
                    val unlockPendingIntent = PendingIntent.getActivity(
                        this,
                        9999,
                        unlockIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
                    )
                    val unlockAction = AuthenticationAction.Builder("Unlock VaultR", unlockPendingIntent).build()
                    responseBuilder.addAuthenticationAction(unlockAction)
                }
                callback.onResult(responseBuilder.build())
                return
            }

            for (option in request.beginGetCredentialOptions) {
                if (option is BeginGetPublicKeyCredentialOption) {
                    val requestJson = option.requestJson
                    var rpId = ""
                    if (requestJson.isNotBlank()) {
                        try {
                            val json = JSONObject(requestJson)
                            rpId = json.optString("rpId")
                            if (rpId.isBlank()) {
                                rpId = json.optJSONObject("publicKey")?.optString("rpId") ?: ""
                            }
                        } catch (_: Exception) {}
                    }

                    if (rpId.isBlank() && origin.isNotBlank()) {
                        rpId = AutofillCredentialStore.normalizeDomain(origin)
                    }
                    if (rpId.isBlank()) {
                        rpId = callingPackage
                    }

                    val passkeys = AutofillCredentialStore.findPasskeys(rpId)
                    Log.d(TAG, "Found ${passkeys.size} passkey(s) matching rpId: '$rpId' (pkg: $callingPackage, origin: $origin)")

                    for (passkey in passkeys) {
                        val authIntent = Intent(this, PasskeyAuthActivity::class.java).apply {
                            action = ACTION_PASSKEY_AUTH
                            putExtra(EXTRA_CREDENTIAL_ID, passkey.id)
                            putExtra(EXTRA_PASSKEY_ID, passkey.passkeyCredentialId)
                            putExtra(EXTRA_RP_ID, rpId)
                            putExtra(EXTRA_REQUEST_JSON, requestJson)
                            putExtra(EXTRA_CALLING_PACKAGE, callingPackage)
                        }

                        val pendingIntent = PendingIntent.getActivity(
                            this,
                            (passkey.passkeyCredentialId ?: passkey.id).hashCode(),
                            authIntent,
                            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
                        )

                        val entry = PublicKeyCredentialEntry.Builder(
                            this,
                            passkey.username.ifBlank { passkey.name },
                            pendingIntent,
                            option
                        ).apply {
                            setDisplayName(passkey.name.ifBlank { passkey.username })
                            setIcon(Icon.createWithResource(this@VaultrCredentialProviderService, R.drawable.ic_vaultr_lock_small))
                            setAutoSelectAllowed(false)
                        }.build()

                        responseBuilder.addCredentialEntry(entry)
                        Log.d(TAG, "Added passkey entry for ${passkey.username} on $rpId")
                    }
                } else if (option is BeginGetPasswordOption) {
                    val target = if (origin.isNotBlank()) origin else callingPackage
                    val matches = AutofillCredentialStore.findMatches(target)
                    Log.d(TAG, "Found ${matches.size} password match(es) for target: '$target'")

                    for (login in matches) {
                        if (login.password.isBlank()) continue

                        val authIntent = Intent(this, PasskeyAuthActivity::class.java).apply {
                            action = ACTION_PASSWORD_AUTH
                            putExtra(EXTRA_CREDENTIAL_ID, login.id)
                            putExtra(EXTRA_USERNAME, login.username)
                            putExtra(EXTRA_PASSWORD, login.password)
                        }

                        val pendingIntent = PendingIntent.getActivity(
                            this,
                            login.id.hashCode(),
                            authIntent,
                            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
                        )

                        val entry = PasswordCredentialEntry.Builder(
                            this,
                            login.username,
                            pendingIntent,
                            option
                        ).apply {
                            setDisplayName(login.name.ifBlank { login.username })
                            setIcon(Icon.createWithResource(this@VaultrCredentialProviderService, R.drawable.ic_vaultr_lock_small))
                            setAutoSelectAllowed(false)
                        }.build()

                        responseBuilder.addCredentialEntry(entry)
                        Log.d(TAG, "Added password entry for ${login.username} on $target")
                    }
                }
            }

            callback.onResult(responseBuilder.build())
        } catch (e: Exception) {
            Log.e(TAG, "Error in onBeginGetCredentialRequest", e)
            callback.onError(GetCredentialUnknownException(e.message ?: "Unknown credential error"))
        }
    }

    override fun onBeginCreateCredentialRequest(
        request: BeginCreateCredentialRequest,
        cancellationSignal: CancellationSignal,
        callback: OutcomeReceiver<BeginCreateCredentialResponse, CreateCredentialException>
    ) {
        try {
            AutofillCredentialStore.initialize(applicationContext)
            val callingAppInfo = request.callingAppInfo
            val callingPackage = callingAppInfo?.packageName ?: ""
            val origin = callingAppInfo?.origin ?: ""

            val responseBuilder = BeginCreateCredentialResponse.Builder()

            if (request is BeginCreatePublicKeyCredentialRequest) {
                val requestJson = request.requestJson
                var rpId = ""
                var username = ""
                var displayName = ""
                if (requestJson.isNotBlank()) {
                    try {
                        val json = JSONObject(requestJson)
                        val rp = json.optJSONObject("rp")
                        rpId = rp?.optString("id") ?: json.optString("rpId")
                        val user = json.optJSONObject("user")
                        username = user?.optString("name") ?: ""
                        displayName = user?.optString("displayName") ?: username
                    } catch (_: Exception) {}
                }

                if (rpId.isBlank() && origin.isNotBlank()) {
                    rpId = AutofillCredentialStore.normalizeDomain(origin)
                }
                if (rpId.isBlank()) {
                    rpId = callingPackage
                }

                val createIntent = Intent(this, PasskeyAuthActivity::class.java).apply {
                    action = ACTION_PASSKEY_CREATE
                    putExtra(EXTRA_RP_ID, rpId)
                    putExtra(EXTRA_USERNAME, username)
                    putExtra(EXTRA_REQUEST_JSON, requestJson)
                    putExtra(EXTRA_CALLING_PACKAGE, callingPackage)
                }

                val pendingIntent = PendingIntent.getActivity(
                    this,
                    rpId.hashCode(),
                    createIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
                )

                val accountLabel = if (username.isNotBlank()) username else if (displayName.isNotBlank()) displayName else "VaultR Passkey"
                val entry = CreateEntry.Builder(
                    accountLabel,
                    pendingIntent
                ).apply {
                    setDescription(rpId.ifBlank { "VaultR" })
                    setIcon(Icon.createWithResource(this@VaultrCredentialProviderService, R.drawable.ic_vaultr_lock_small))
                    setAutoSelectAllowed(false)
                }.build()

                responseBuilder.addCreateEntry(entry)
                Log.d(TAG, "Added passkey create entry for '$accountLabel' on $rpId")
            } else if (request is BeginCreatePasswordCredentialRequest) {
                val target = if (origin.isNotBlank()) origin else callingPackage
                val createIntent = Intent(this, PasskeyAuthActivity::class.java).apply {
                    action = ACTION_PASSWORD_CREATE
                    putExtra(EXTRA_RP_ID, target)
                    putExtra(EXTRA_CALLING_PACKAGE, callingPackage)
                }

                val pendingIntent = PendingIntent.getActivity(
                    this,
                    target.hashCode(),
                    createIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
                )

                val entry = CreateEntry.Builder(
                    "VaultR Password",
                    pendingIntent
                ).apply {
                    setDescription(target)
                    setIcon(Icon.createWithResource(this@VaultrCredentialProviderService, R.drawable.ic_vaultr_lock_small))
                    setAutoSelectAllowed(false)
                }.build()

                responseBuilder.addCreateEntry(entry)
                Log.d(TAG, "Added password create entry on $target")
            }

            callback.onResult(responseBuilder.build())
        } catch (e: Exception) {
            Log.e(TAG, "Error in onBeginCreateCredentialRequest", e)
            callback.onError(CreateCredentialUnknownException(e.message ?: "Creation error"))
        }
    }

    override fun onClearCredentialStateRequest(
        request: ProviderClearCredentialStateRequest,
        cancellationSignal: CancellationSignal,
        callback: OutcomeReceiver<Void?, ClearCredentialException>
    ) {
        try {
            callback.onResult(null)
        } catch (e: Exception) {
            callback.onError(ClearCredentialUnknownException(e.message ?: "Clear state error"))
        }
    }
}
