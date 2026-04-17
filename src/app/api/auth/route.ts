export const runtime = "nodejs";

import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { adminAuth } from '@/lib/firebase/admin';

export async function POST(req: Request) {
  try {
    const { address, signature, message } = await req.json();

    if (!address || !signature || !message) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // 1. Cryptographically verify the SIWE signature against the claimed address
    const recoveredAddress = ethers.verifyMessage(message, signature);
    
    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 });
    }

    if (!adminAuth) {
      // Fallback for demo purposes if backend isn't fully configured
      return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 });
    }

    // 2. Mint a Firebase Custom Token mapped strictly to the recovered EVM address
    const firebaseToken = await adminAuth.createCustomToken(recoveredAddress.toLowerCase());

    return NextResponse.json({ token: firebaseToken });
  } catch (error) {
    console.error("Auth routing error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
