package com.vaultr.mobile.autofill

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.Base64
import android.util.Log
import androidx.annotation.RequiresApi
import androidx.credentials.CreatePasswordResponse
import androidx.credentials.CreatePublicKeyCredentialRequest
import androidx.credentials.CreatePublicKeyCredentialResponse
import androidx.credentials.GetCredentialResponse
import androidx.credentials.GetPublicKeyCredentialOption
import androidx.credentials.PasswordCredential
import androidx.credentials.PublicKeyCredential
import androidx.credentials.exceptions.CreateCredentialUnknownException
import androidx.credentials.exceptions.GetCredentialUnknownException
import androidx.credentials.provider.PendingIntentHandler
import androidx.credentials.provider.ProviderCreateCredentialRequest
import org.json.JSONObject
import java.nio.ByteBuffer
import java.security.KeyFactory
import java.security.KeyPairGenerator
import java.security.MessageDigest
import java.security.SecureRandom
import java.security.Signature
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec
import java.security.spec.PKCS8EncodedKeySpec

/**
 * PasskeyAuthActivity — System Credential Manager Assertion & Registration Bridge.
 *
 * Transparent activity triggered when the user selects a VaultR passkey/password candidate
 * or creates a new passkey/password in the Android Credential Manager bottom sheet.
 * Performs standard ECDSA P-256 assertion signing and key generation, returning the
 * credentials directly to Android OS via PendingIntentHandler.
 */
@RequiresApi(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
class PasskeyAuthActivity : Activity() {

    companion object {
        private const val TAG = "VaultrPasskeyAuth"

        // Official VaultR Authenticator Attestation Globally Unique Identifier (AAGUID)
        // Format: RFC 4122 v4 UUID, hex prefix: 0x76 61 75 6c 74 72 = "vaultr" in ASCII
        const val VAULTR_AAGUID = "7661756c-7472-4a11-8517-5e839e55720c"
        val VAULTR_AAGUID_BYTES = byteArrayOf(
            0x76.toByte(), 0x61.toByte(), 0x75.toByte(), 0x6c.toByte(),
            0x74.toByte(), 0x72.toByte(), 0x4a.toByte(), 0x11.toByte(),
            0x85.toByte(), 0x17.toByte(), 0x5e.toByte(), 0x83.toByte(),
            0x9e.toByte(), 0x55.toByte(), 0x72.toByte(), 0x0c.toByte()
        )

        // Fixed ASN.1 PKCS#8 prefix for SECP256R1 (ECDSA P-256) private key wrapping
        private val PKCS8_P256_PREFIX = byteArrayOf(
            0x30.toByte(), 0x41.toByte(), 0x02.toByte(), 0x01.toByte(), 0x00.toByte(), 0x30.toByte(),
            0x13.toByte(), 0x06.toByte(), 0x07.toByte(), 0x2a.toByte(), 0x86.toByte(), 0x48.toByte(),
            0xce.toByte(), 0x3d.toByte(), 0x02.toByte(), 0x01.toByte(), 0x06.toByte(), 0x08.toByte(),
            0x2a.toByte(), 0x86.toByte(), 0x48.toByte(), 0xce.toByte(), 0x3d.toByte(), 0x03.toByte(),
            0x01.toByte(), 0x07.toByte(), 0x04.toByte(), 0x27.toByte(), 0x30.toByte(), 0x25.toByte(),
            0x02.toByte(), 0x01.toByte(), 0x01.toByte(), 0x04.toByte(), 0x20.toByte()
        )

        fun decodeBase64Flexible(input: String): ByteArray {
            var sanitized = input.trim().replace('-', '+').replace('_', '/')
            while (sanitized.length % 4 != 0) {
                sanitized += "="
            }
            return Base64.decode(sanitized, Base64.DEFAULT)
        }

        fun encodeBase64Url(bytes: ByteArray): String {
            return Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING).trim()
        }

        fun decodePrivateKey(rawKey: String): ByteArray {
            var cleaned = rawKey.trim()
            if (cleaned.contains("-----BEGIN")) {
                cleaned = cleaned.replace("-----BEGIN [A-Z0-9 ]+-----".toRegex(), "")
                    .replace("-----END [A-Z0-9 ]+-----".toRegex(), "")
                    .replace("\\s+".toRegex(), "")
            }
            val keyBytes = decodeBase64Flexible(cleaned)
            return if (keyBytes.size == 32) {
                PKCS8_P256_PREFIX + keyBytes
            } else {
                keyBytes
            }
        }

        fun getRawCoords(bigInt: java.math.BigInteger): ByteArray {
            val raw = bigInt.toByteArray()
            if (raw.size == 32) return raw
            val out = ByteArray(32)
            if (raw.size > 32) {
                System.arraycopy(raw, raw.size - 32, out, 0, 32)
            } else {
                System.arraycopy(raw, 0, out, 32 - raw.size, raw.size)
            }
            return out
        }

        fun encodeCosePublicKey(xCoord: ByteArray, yCoord: ByteArray): ByteArray {
            // Map of 5 items: 0xa5
            // 1 => 2:        0x01, 0x02
            // 3 => -7:       0x03, 0x26 (-7 is encoded as 0x20 + 6 = 0x26)
            // -1 => 1:       0x20, 0x01 (-1 is encoded as 0x20)
            // -2 => bstr(32): 0x21, 0x58, 0x20, [32 bytes x]
            // -3 => bstr(32): 0x22, 0x58, 0x20, [32 bytes y]
            val header = byteArrayOf(
                0xa5.toByte(),
                0x01.toByte(), 0x02.toByte(),
                0x03.toByte(), 0x26.toByte(),
                0x20.toByte(), 0x01.toByte(),
                0x21.toByte(), 0x58.toByte(), 0x20.toByte()
            )
            val mid = byteArrayOf(0x22.toByte(), 0x58.toByte(), 0x20.toByte())
            val out = ByteArray(header.size + xCoord.size + mid.size + yCoord.size)
            var offset = 0
            System.arraycopy(header, 0, out, offset, header.size); offset += header.size
            System.arraycopy(xCoord, 0, out, offset, xCoord.size); offset += xCoord.size
            System.arraycopy(mid, 0, out, offset, mid.size); offset += mid.size
            System.arraycopy(yCoord, 0, out, offset, yCoord.size)
            return out
        }

        fun encodeAttestationObjectNone(authData: ByteArray): ByteArray {
            val keysAndFmt = byteArrayOf(
                // "fmt": "none"
                0x63.toByte(), 0x66.toByte(), 0x6d.toByte(), 0x74.toByte(),
                0x64.toByte(), 0x6e.toByte(), 0x6f.toByte(), 0x6e.toByte(), 0x65.toByte(),
                // "attStmt": {}
                0x67.toByte(), 0x61.toByte(), 0x74.toByte(), 0x74.toByte(), 0x53.toByte(), 0x74.toByte(), 0x6d.toByte(), 0x74.toByte(),
                0xa0.toByte(),
                // "authData" key
                0x68.toByte(), 0x61.toByte(), 0x75.toByte(), 0x74.toByte(), 0x68.toByte(), 0x44.toByte(), 0x61.toByte(), 0x74.toByte(), 0x61.toByte()
            )
            val len = authData.size
            val lenHeader = when {
                len < 24 -> byteArrayOf((0x40 + len).toByte())
                len <= 0xff -> byteArrayOf(0x58.toByte(), len.toByte())
                len <= 0xffff -> byteArrayOf(0x59.toByte(), ((len shr 8) and 0xff).toByte(), (len and 0xff).toByte())
                else -> byteArrayOf(
                    0x5a.toByte(),
                    ((len shr 24) and 0xff).toByte(),
                    ((len shr 16) and 0xff).toByte(),
                    ((len shr 8) and 0xff).toByte(),
                    (len and 0xff).toByte()
                )
            }
            val out = ByteArray(1 + keysAndFmt.size + lenHeader.size + authData.size)
            out[0] = 0xa3.toByte()
            var offset = 1
            System.arraycopy(keysAndFmt, 0, out, offset, keysAndFmt.size); offset += keysAndFmt.size
            System.arraycopy(lenHeader, 0, out, offset, lenHeader.size); offset += lenHeader.size
            System.arraycopy(authData, 0, out, offset, authData.size)
            return out
        }

        fun getApkKeyHash(pm: android.content.pm.PackageManager, packageName: String): String? {
            try {
                val signatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    val signingInfo = pm.getPackageInfo(packageName, android.content.pm.PackageManager.GET_SIGNING_CERTIFICATES).signingInfo
                    if (signingInfo != null) {
                        if (signingInfo.hasMultipleSigners()) {
                            signingInfo.apkContentsSigners
                        } else {
                            signingInfo.signingCertificateHistory
                        }
                    } else null
                } else {
                    @Suppress("DEPRECATION")
                    pm.getPackageInfo(packageName, android.content.pm.PackageManager.GET_SIGNATURES).signatures
                }
                val cert = signatures?.firstOrNull()?.toByteArray() ?: return null
                val digest = MessageDigest.getInstance("SHA-256").digest(cert)
                return encodeBase64Url(digest)
            } catch (e: Exception) {
                return null
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        try {
            AutofillCredentialStore.initialize(applicationContext)

            val action = intent.action
            Log.d(TAG, "PasskeyAuthActivity launched with action: $action")

            when (action) {
                VaultrCredentialProviderService.ACTION_PASSKEY_AUTH -> handlePasskeyAuth()
                VaultrCredentialProviderService.ACTION_PASSWORD_AUTH -> handlePasswordAuth()
                VaultrCredentialProviderService.ACTION_PASSKEY_CREATE -> handlePasskeyCreate()
                VaultrCredentialProviderService.ACTION_PASSWORD_CREATE -> handlePasswordCreate()
                else -> {
                    Log.w(TAG, "Unknown action: $action")
                    finishWithFailure("Unknown credential action: $action")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Fatal error in PasskeyAuthActivity", e)
            val action = intent.action
            if (action == VaultrCredentialProviderService.ACTION_PASSKEY_CREATE || action == VaultrCredentialProviderService.ACTION_PASSWORD_CREATE) {
                finishWithCreateFailure(e.message ?: "Creation error")
            } else {
                finishWithFailure(e.message ?: "Authentication error")
            }
        }
    }

    private fun handlePasskeyAuth() {
        val resultIntent = Intent()

        // 1. Retrieve system request from framework if present
        val getRequest = PendingIntentHandler.retrieveProviderGetCredentialRequest(intent)
        val publicKeyOption = getRequest?.credentialOptions?.filterIsInstance<GetPublicKeyCredentialOption>()?.firstOrNull()

        val credentialId = intent.getStringExtra(VaultrCredentialProviderService.EXTRA_CREDENTIAL_ID) ?: ""
        val passkeyId = intent.getStringExtra(VaultrCredentialProviderService.EXTRA_PASSKEY_ID) ?: ""
        var rpId = intent.getStringExtra(VaultrCredentialProviderService.EXTRA_RP_ID) ?: ""
        val callingPkg = getRequest?.callingAppInfo?.packageName
            ?: intent.getStringExtra(VaultrCredentialProviderService.EXTRA_CALLING_PACKAGE)
            ?: ""

        // 2. Find matching passkey item in store
        var item: AutofillItem? = null
        if (passkeyId.isNotBlank()) {
            item = AutofillCredentialStore.findPasskeyByCredentialId(passkeyId)
        }
        if (item == null && credentialId.isNotBlank()) {
            item = AutofillCredentialStore.getAll().find { it.id == credentialId || it.passkeyCredentialId == credentialId }
        }

        if (item == null || item.passkeyPrivateKey.isNullOrBlank()) {
            Log.e(TAG, "Passkey item not found or missing private key for credentialId: $credentialId / passkeyId: $passkeyId")
            finishWithFailure("Passkey private key not available or vault locked")
            return
        }

        if (rpId.isBlank()) {
            rpId = item.passkeyRpId ?: item.domain ?: ""
        }

        // 3. Extract request JSON, challenge, and clientDataHash
        val requestJson = publicKeyOption?.requestJson
            ?: intent.getStringExtra(VaultrCredentialProviderService.EXTRA_REQUEST_JSON)
            ?: ""
        val clientDataHashFromOption = publicKeyOption?.clientDataHash

        var challengeStr = ""
        if (requestJson.isNotBlank()) {
            try {
                val root = JSONObject(requestJson)
                challengeStr = root.optString("challenge")
                if (challengeStr.isBlank() && root.has("publicKey")) {
                    challengeStr = root.getJSONObject("publicKey").optString("challenge")
                }
            } catch (_: Exception) {}
        }
        if (challengeStr.isBlank()) {
            challengeStr = encodeBase64Url(ByteArray(32))
        }

        val callingAppInfo = getRequest?.callingAppInfo
        val origin = when {
            !callingAppInfo?.origin.isNullOrBlank() -> callingAppInfo!!.origin
            callingPkg.isNotBlank() -> {
                val apkHash = getApkKeyHash(packageManager, callingPkg)
                if (apkHash != null) "android:apk-key-hash:$apkHash" else "https://$rpId"
            }
            else -> "https://$rpId"
        }

        // Build clientDataJSON (W3C WebAuthn L3 standard with crossOrigin: false)
        val clientDataJsonObj = JSONObject().apply {
            put("type", "webauthn.get")
            put("challenge", challengeStr)
            put("origin", origin)
            put("crossOrigin", false)
            if (callingPkg.isNotBlank()) {
                put("androidPackageName", callingPkg)
            }
        }
        val clientDataJsonBytes = clientDataJsonObj.toString().toByteArray(Charsets.UTF_8)
        val clientDataJsonB64Url = encodeBase64Url(clientDataJsonBytes)

        val clientDataHash = clientDataHashFromOption
            ?: MessageDigest.getInstance("SHA-256").digest(clientDataJsonBytes)

        // 4. Build Authenticator Data (37 bytes)
        // 32 bytes rpIdHash + 1 byte flags (UP=0x01, UV=0x04, BE=0x08, BS=0x10 = 0x1d) + 4 bytes signCount (0)
        val rpIdHash = MessageDigest.getInstance("SHA-256").digest(rpId.toByteArray(Charsets.UTF_8))
        val flags = (0x01 or 0x04 or 0x08 or 0x10).toByte()
        val nextSignCount = 0L
        val signCountBytes = ByteBuffer.allocate(4).putInt(0).array()

        val authData = ByteArray(37)
        System.arraycopy(rpIdHash, 0, authData, 0, 32)
        authData[32] = flags
        System.arraycopy(signCountBytes, 0, authData, 33, 4)

        // 5. Sign: authData || clientDataHash using ECDSA P-256
        val toBeSigned = ByteArray(authData.size + clientDataHash.size)
        System.arraycopy(authData, 0, toBeSigned, 0, authData.size)
        System.arraycopy(clientDataHash, 0, toBeSigned, authData.size, clientDataHash.size)

        val privateKeyBytes = decodePrivateKey(item.passkeyPrivateKey!!)
        val keyFactory = KeyFactory.getInstance("EC")
        val privateKey = keyFactory.generatePrivate(PKCS8EncodedKeySpec(privateKeyBytes))

        val signer = Signature.getInstance("SHA256withECDSA")
        signer.initSign(privateKey)
        signer.update(toBeSigned)
        val derSignature = signer.sign()

        val authDataB64Url = encodeBase64Url(authData)
        val sigB64Url = encodeBase64Url(derSignature)
        val rawCredIdB64Url = item.passkeyCredentialId ?: credentialId

        // 6. Build W3C FIDO2 assertion response JSON
        val responseObj = JSONObject().apply {
            put("id", rawCredIdB64Url)
            put("rawId", rawCredIdB64Url)
            put("type", "public-key")
            put("authenticatorAttachment", "platform")

            val responseInner = JSONObject().apply {
                put("clientDataJSON", clientDataJsonB64Url)
                put("authenticatorData", authDataB64Url)
                put("signature", sigB64Url)
                if (!item.passkeyUserHandle.isNullOrBlank()) {
                    put("userHandle", item.passkeyUserHandle)
                }
            }
            put("response", responseInner)
            put("clientExtensionResults", JSONObject())
        }

        val responseJson = responseObj.toString()
        Log.d(TAG, "Successfully generated passkey assertion for ${item.username} on $rpId")

        // 7. Update signCount in store
        AutofillCredentialStore.updatePasskeySignCount(
            item.passkeyCredentialId ?: item.id,
            nextSignCount,
            applicationContext
        )

        // 8. Deliver GetCredentialResponse to Android OS
        val publicKeyCredential = PublicKeyCredential(responseJson)
        val getCredentialResponse = GetCredentialResponse(publicKeyCredential)
        PendingIntentHandler.setGetCredentialResponse(resultIntent, getCredentialResponse)

        setResult(Activity.RESULT_OK, resultIntent)
        finish()
    }

    private fun handlePasskeyCreate() {
        val resultIntent = Intent()

        val createRequest = PendingIntentHandler.retrieveProviderCreateCredentialRequest(intent)
        val callingRequest = createRequest?.callingRequest as? CreatePublicKeyCredentialRequest
        val requestJson = callingRequest?.requestJson
            ?: intent.getStringExtra(VaultrCredentialProviderService.EXTRA_REQUEST_JSON)
            ?: ""
        val callingAppInfo = createRequest?.callingAppInfo
        val callingPkg = callingAppInfo?.packageName
            ?: intent.getStringExtra(VaultrCredentialProviderService.EXTRA_CALLING_PACKAGE)
            ?: ""

        var rpId = intent.getStringExtra(VaultrCredentialProviderService.EXTRA_RP_ID) ?: ""
        var challengeStr = ""
        var userHandleStr = ""
        var username = intent.getStringExtra(VaultrCredentialProviderService.EXTRA_USERNAME) ?: ""

        if (requestJson.isNotBlank()) {
            try {
                val root = JSONObject(requestJson)
                val rp = root.optJSONObject("rp")
                if (rp != null && rp.optString("id").isNotBlank()) {
                    rpId = rp.optString("id")
                }
                val user = root.optJSONObject("user")
                if (user != null) {
                    if (username.isBlank()) {
                        username = user.optString("name", "")
                    }
                    userHandleStr = user.optString("id", "")
                }
                challengeStr = root.optString("challenge", "")
            } catch (_: Exception) {}
        }

        if (rpId.isBlank()) {
            rpId = callingPkg
        }
        if (challengeStr.isBlank()) {
            challengeStr = encodeBase64Url(ByteArray(32))
        }

        // 1. Generate EC P-256 KeyPair
        val kpg = KeyPairGenerator.getInstance("EC")
        kpg.initialize(ECGenParameterSpec("secp256r1"))
        val keyPair = kpg.generateKeyPair()
        val privKey = keyPair.private
        val pubKey = keyPair.public as ECPublicKey

        val privKeyBytes = privKey.encoded // PKCS#8 format
        val privKeyB64Url = encodeBase64Url(privKeyBytes)

        val xBytes = getRawCoords(pubKey.w.affineX)
        val yBytes = getRawCoords(pubKey.w.affineY)
        val coseKey = encodeCosePublicKey(xBytes, yBytes)

        // 2. Random 32-byte credentialId
        val credIdBytes = ByteArray(32)
        SecureRandom().nextBytes(credIdBytes)
        val credIdB64Url = encodeBase64Url(credIdBytes)

        // 3. Authenticator Data for registration (fmt: "none", flags: UP | UV | AT)
        val rpIdHash = MessageDigest.getInstance("SHA-256").digest(rpId.toByteArray(Charsets.UTF_8))
        val authDataLen = 32 + 1 + 4 + 16 + 2 + credIdBytes.size + coseKey.size
        val authData = ByteArray(authDataLen)
        var offset = 0
        System.arraycopy(rpIdHash, 0, authData, offset, 32); offset += 32
        authData[offset] = (0x01 or 0x04 or 0x08 or 0x10 or 0x40).toByte(); offset += 1 // UP | UV | BE | BS | AT (0x5d)
        val signCountBytes = ByteBuffer.allocate(4).putInt(0).array()
        System.arraycopy(signCountBytes, 0, authData, offset, 4); offset += 4
        val aaguid = VAULTR_AAGUID_BYTES.clone()
        System.arraycopy(aaguid, 0, authData, offset, 16); offset += 16
        val credIdLenBytes = byteArrayOf(((credIdBytes.size shr 8) and 0xff).toByte(), (credIdBytes.size and 0xff).toByte())
        System.arraycopy(credIdLenBytes, 0, authData, offset, 2); offset += 2
        System.arraycopy(credIdBytes, 0, authData, offset, credIdBytes.size); offset += credIdBytes.size
        System.arraycopy(coseKey, 0, authData, offset, coseKey.size)

        val attestationObject = encodeAttestationObjectNone(authData)
        val attestationObjectB64Url = encodeBase64Url(attestationObject)

        // 4. Build clientDataJSON
        val origin = when {
            !callingAppInfo?.origin.isNullOrBlank() -> callingAppInfo!!.origin
            callingPkg.isNotBlank() -> {
                val apkHash = getApkKeyHash(packageManager, callingPkg)
                if (apkHash != null) "android:apk-key-hash:$apkHash" else "https://$rpId"
            }
            else -> "https://$rpId"
        }

        val clientDataJsonObj = JSONObject().apply {
            put("type", "webauthn.create")
            put("challenge", challengeStr)
            put("origin", origin)
            put("crossOrigin", false)
            if (callingPkg.isNotBlank()) {
                put("androidPackageName", callingPkg)
            }
        }
        val clientDataJsonBytes = clientDataJsonObj.toString().toByteArray(Charsets.UTF_8)
        val clientDataJsonB64Url = encodeBase64Url(clientDataJsonBytes)

        // 5. Build W3C FIDO2 registration response JSON
        val responseObj = JSONObject().apply {
            put("id", credIdB64Url)
            put("rawId", credIdB64Url)
            put("type", "public-key")
            put("authenticatorAttachment", "platform")
            val responseInner = JSONObject().apply {
                put("clientDataJSON", clientDataJsonB64Url)
                put("attestationObject", attestationObjectB64Url)
                put("transports", org.json.JSONArray().apply {
                    put("internal")
                    put("hybrid")
                })
            }
            put("response", responseInner)
            put("clientExtensionResults", JSONObject())
        }

        // 6. Deliver CreatePublicKeyCredentialResponse to Android OS
        val createResponse = CreatePublicKeyCredentialResponse(responseObj.toString())
        PendingIntentHandler.setCreateCredentialResponse(resultIntent, createResponse)

        // 7. Save passkey to AutofillCredentialStore
        val newPasskeyItem = AutofillItem(
            id = "passkey_" + System.currentTimeMillis() + "_" + credIdB64Url.take(8),
            name = if (username.isNotBlank()) "$username ($rpId)" else rpId,
            domain = rpId,
            username = username,
            password = "",
            urls = listOf("https://$rpId"),
            isPasskey = true,
            passkeyRpId = rpId,
            passkeyCredentialId = credIdB64Url,
            passkeyUserHandle = userHandleStr.ifBlank { encodeBase64Url(username.toByteArray(Charsets.UTF_8)) },
            passkeyPrivateKey = privKeyB64Url,
            passkeySignCount = 0L,
            passkeyTransports = listOf("internal", "hybrid")
        )
        AutofillCredentialStore.addOrUpdatePasskey(newPasskeyItem, applicationContext)
        Log.d(TAG, "Successfully created and saved new passkey for $username on $rpId")

        setResult(Activity.RESULT_OK, resultIntent)
        finish()
    }

    private fun handlePasswordAuth() {
        val resultIntent = Intent()
        val username = intent.getStringExtra(VaultrCredentialProviderService.EXTRA_USERNAME) ?: ""
        val password = intent.getStringExtra(VaultrCredentialProviderService.EXTRA_PASSWORD) ?: ""

        if (username.isBlank() && password.isBlank()) {
            finishWithFailure("Password credential was empty")
            return
        }

        val passwordCredential = PasswordCredential(username, password)
        val getCredentialResponse = GetCredentialResponse(passwordCredential)
        PendingIntentHandler.setGetCredentialResponse(resultIntent, getCredentialResponse)

        Log.d(TAG, "Successfully returned password credential for $username")
        setResult(Activity.RESULT_OK, resultIntent)
        finish()
    }

    private fun handlePasswordCreate() {
        val resultIntent = Intent()
        val createResponse = CreatePasswordResponse()
        PendingIntentHandler.setCreateCredentialResponse(resultIntent, createResponse)
        Log.d(TAG, "Successfully handled password create")
        setResult(Activity.RESULT_OK, resultIntent)
        finish()
    }

    private fun finishWithFailure(message: String) {
        val resultIntent = Intent()
        PendingIntentHandler.setGetCredentialException(
            resultIntent,
            GetCredentialUnknownException(message)
        )
        setResult(Activity.RESULT_CANCELED, resultIntent)
        finish()
    }

    private fun finishWithCreateFailure(message: String) {
        val resultIntent = Intent()
        PendingIntentHandler.setCreateCredentialException(
            resultIntent,
            CreateCredentialUnknownException(message)
        )
        setResult(Activity.RESULT_CANCELED, resultIntent)
        finish()
    }
}

