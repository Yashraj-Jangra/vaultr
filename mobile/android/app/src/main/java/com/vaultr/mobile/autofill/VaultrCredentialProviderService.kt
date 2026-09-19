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
import androidx.credentials.provider.BeginGetCredentialRequest
import androidx.credentials.provider.BeginGetCredentialResponse
import androidx.credentials.provider.BeginGetPasswordOption
import androidx.credentials.provider.BeginGetPublicKeyCredentialOption
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
                Log.d(TAG, "Vault locked during onBeginGetCredentialRequest — adding Unlock VaultR action")
                val unlockIntent = Intent(this, MainActivity::class.java).apply {
                    action = Intent.ACTION_MAIN
                    addCategory(Intent.CATEGORY_LAUNCHER)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                }
                val unlockPendingIntent = PendingIntent.getActivity(
                    this,
                    9999,
                    unlockIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                val unlockAction = AuthenticationAction.Builder("Unlock VaultR", unlockPendingIntent).build()
                responseBuilder.addAuthenticationAction(unlockAction)
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
            val responseBuilder = BeginCreateCredentialResponse.Builder()
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
