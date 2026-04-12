import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { verifyAdminToken } from "@/lib/firebase/verifyAdmin";

export async function GET(req: NextRequest) {
  try {
    await verifyAdminToken(req);
    if (!adminAuth) {
      return NextResponse.json({ error: "Firebase Admin Auth not initialized" }, { status: 503 });
    }

    const url = new URL(req.url);
    const maxResults = parseInt(url.searchParams.get("maxResults") || "100", 10);
    const pageToken = url.searchParams.get("pageToken") || undefined;

    const listUsersResult = await adminAuth.listUsers(maxResults, pageToken);
    
    // Map internal user representation to safe client representation
    const users = listUsersResult.users.map((record) => ({
      uid: record.uid,
      email: record.email,
      displayName: record.displayName,
      creationTime: record.metadata.creationTime,
      lastSignInTime: record.metadata.lastSignInTime,
      disabled: record.disabled,
      isAdmin: !!record.customClaims?.admin,
    }));

    return NextResponse.json({
      users,
      pageToken: listUsersResult.pageToken,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error listing users:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
