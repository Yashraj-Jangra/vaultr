import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { verifyAdminToken } from "@/lib/firebase/verifyAdmin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> } // In Next.js 16 app router dynamic params are Promises
) {
  try {
    await verifyAdminToken(req);
    if (!adminAuth) return NextResponse.json({ error: "Firebase Admin Auth not initialized" }, { status: 503 });
    const { uid } = await params;
    
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "disable":
        await adminAuth.updateUser(uid, { disabled: true });
        return NextResponse.json({ success: true, message: "User disabled" });
        
      case "enable":
        await adminAuth.updateUser(uid, { disabled: false });
        return NextResponse.json({ success: true, message: "User enabled" });
        
      case "promote":
        // Get existing claims to avoid overwriting others if they exist
        const currentUser = await adminAuth.getUser(uid);
        const currentClaims = currentUser.customClaims || {};
        await adminAuth.setCustomUserClaims(uid, { ...currentClaims, admin: true });
        return NextResponse.json({ success: true, message: "User promoted to admin" });
        
      case "demote":
        const userToDemote = await adminAuth.getUser(uid);
        const claims = userToDemote.customClaims || {};
        delete claims.admin;
        await adminAuth.setCustomUserClaims(uid, claims);
        return NextResponse.json({ success: true, message: "User demoted from admin" });
        
      case "delete":
        await adminAuth.deleteUser(uid);
        return NextResponse.json({ success: true, message: "User deleted" });
        
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(`Error updating user:`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
