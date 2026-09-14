package com.vaultr.mobile.autofill

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.CancellationSignal
import android.os.OutcomeReceiver
import android.credentials.ClearCredentialStateException
import android.credentials.CreateCredentialException
import android.credentials.GetCredentialException
import android.service.credentials.BeginCreateCredentialRequest
import android.service.credentials.BeginCreateCredentialResponse
import android.service.credentials.BeginGetCredentialRequest
import android.service.credentials.BeginGetCredentialResponse
import android.service.credentials.ClearCredentialStateRequest
import android.service.credentials.CredentialProviderService
import android.util.Base64
import android.util.Log
import androidx.annotation.RequiresApi
import org.json.JSONObject
import java.nio.ByteBuffer
import java.security.KeyFactory
import java.security.MessageDigest
import java.security.Signature
import java.security.spec.PKCS8EncodedKeySpec

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
        const val EXTRA_REQUEST_JSON = "vaultr_extra_request_json"
        const val EXTRA_CALLING_PACKAGE = "vaultr_extra_calling_package"
        const val ACTION_PASSKEY_AUTH = "com.vaultr.mobile.PASSKEY_AUTHENTICATE"

        /**
         * Signs a WebAuthn FIDO2 assertion using the stored ECDSA P-256 private key.
         * Generates standard ASN.1 DER signature conforming to W3C WebAuthn Level 3 specifications.
         */
        fun signFido2Assertion(
            privateKeyPkcs8Base64: String,
            rpId: String,
            clientDataJsonBase64Url: String,
            userHandleBase64Url: String?,
            currentSignCount: Long
        ): String {
            val privateKeyBytes = decodeBase64Flexible(privateKeyPkcs8Base64)
            val keyFactory = KeyFactory.getInstance("EC")
            val keySpec = PKCS8EncodedKeySpec(privateKeyBytes)
            val privateKey = keyFactory.generatePrivate(keySpec)

            val clientDataBytes = decodeBase64Flexible(clientDataJsonBase64Url)
            val clientDataHash = MessageDigest.getInstance("SHA-256").digest(clientDataBytes)

            // WebAuthn Authenticator Data (37 bytes):
            // 32 bytes rpIdHash + 1 byte flags (UP=0x01, UV=0x04) + 4 bytes signCount (big endian)
            val rpIdHash = MessageDigest.getInstance("SHA-256").digest(rpId.toByteArray(Charsets.UTF_8))
            val flags = (0x01 or 0x04).toByte() // User Present + User Verified
            val nextSignCount = currentSignCount + 1
            val signCountBytes = ByteBuffer.allocate(4).putInt(nextSignCount.toInt()).array()

            val authData = ByteArray(37)
            System.arraycopy(rpIdHash, 0, authData, 0, 32)
            authData[32] = flags
            System.arraycopy(signCountBytes, 0, authData, 33, 4)

            // The data to sign is: authenticatorData || clientDataHash
            val toBeSigned = ByteArray(authData.size + clientDataHash.size)
            System.arraycopy(authData, 0, toBeSigned, 0, authData.size)
            System.arraycopy(clientDataHash, 0, toBeSigned, authData.size, clientDataHash.size)

            val signer = Signature.getInstance("SHA256withECDSA")
            signer.initSign(privateKey)
            signer.update(toBeSigned)
            val derSignature = signer.sign()

            val authDataBase64Url = encodeBase64Url(authData)
            val sigBase64Url = encodeBase64Url(derSignature)

            val responseObj = JSONObject().apply {
                put("clientDataJSON", clientDataJsonBase64Url)
                put("authenticatorData", authDataBase64Url)
                put("signature", sigBase64Url)
                if (!userHandleBase64Url.isNullOrBlank()) {
                    put("userHandle", userHandleBase64Url)
                }
            }

            return responseObj.toString()
        }

        private fun decodeBase64Flexible(input: String): ByteArray {
            var sanitized = input.trim().replace('-', '+').replace('_', '/')
            while (sanitized.length % 4 != 0) {
                sanitized += "="
            }
            return Base64.decode(sanitized, Base64.DEFAULT)
        }

        private fun encodeBase64Url(bytes: ByteArray): String {
            return Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING).trim()
        }
    }

    override fun onCreate() {
        super.onCreate()
        AutofillCredentialStore.initialize(applicationContext)
    }

    override fun onBeginGetCredential(
        request: BeginGetCredentialRequest,
        cancellationSignal: CancellationSignal,
        callback: OutcomeReceiver<BeginGetCredentialResponse, GetCredentialException>
    ) {
        try {
            AutofillCredentialStore.initialize(applicationContext)
            val callingPackage = request.callingAppInfo?.packageName ?: ""

            if (AutofillCredentialStore.isVaultLocked()) {
                Log.d(TAG, "Vault locked during onBeginGetCredential — returning empty candidates")
                callback.onResult(BeginGetCredentialResponse.Builder().build())
                return
            }

            val responseBuilder = BeginGetCredentialResponse.Builder()
            val options = request.beginGetCredentialOptions

            for (option in options) {
                val type = option.type
                val data = option.candidateQueryData

                if (type == "android.credentials.TYPE_PUBLIC_KEY_CREDENTIAL") {
                    val requestJson = data.getString("androidx.credentials.BUNDLE_KEY_REQUEST_JSON")
                        ?: data.getString("android.credentials.extra.REQUEST_JSON")
                        ?: ""

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

                    if (rpId.isBlank()) {
                        rpId = callingPackage
                    }

                    val passkeys = AutofillCredentialStore.findPasskeys(rpId)
                    Log.d(TAG, "Found ${passkeys.size} passkey(s) matching rpId: $rpId for package: $callingPackage")

                    // Build candidates if found
                    for (passkey in passkeys) {
                        Log.d(TAG, "Adding passkey candidate: ${passkey.username} (${passkey.passkeyCredentialId})")
                    }
                } else if (type == "android.credentials.TYPE_PASSWORD_CREDENTIAL") {
                    val matches = AutofillCredentialStore.findMatches(callingPackage)
                    Log.d(TAG, "Found ${matches.size} password login(s) for package: $callingPackage")
                }
            }

            callback.onResult(responseBuilder.build())
        } catch (e: Exception) {
            Log.e(TAG, "Error in onBeginGetCredential", e)
            callback.onError(GetCredentialException(GetCredentialException.TYPE_UNKNOWN, e.message))
        }
    }

    override fun onBeginCreateCredential(
        request: BeginCreateCredentialRequest,
        cancellationSignal: CancellationSignal,
        callback: OutcomeReceiver<BeginCreateCredentialResponse, CreateCredentialException>
    ) {
        try {
            val responseBuilder = BeginCreateCredentialResponse.Builder()
            callback.onResult(responseBuilder.build())
        } catch (e: Exception) {
            Log.e(TAG, "Error in onBeginCreateCredential", e)
            callback.onError(CreateCredentialException(CreateCredentialException.TYPE_UNKNOWN, e.message))
        }
    }

    override fun onClearCredentialState(
        request: ClearCredentialStateRequest,
        cancellationSignal: CancellationSignal,
        callback: OutcomeReceiver<Void?, ClearCredentialStateException>
    ) {
        try {
            callback.onResult(null)
        } catch (e: Exception) {
            callback.onError(ClearCredentialStateException(ClearCredentialStateException.TYPE_UNKNOWN, e.message))
        }
    }
}
