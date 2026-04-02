import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Sanitize filename by removing accents, replacing special characters
 * @param name - The original filename
 * @returns The sanitized filename
 */
function sanitizeFileName(name: string): string {
  // Normalize to NFD (decomposed form) to separate accents
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Replace spaces and special characters with underscore
  let sanitized = normalized.replace(/[^a-zA-Z0-9._-]/g, "_");

  // Collapse multiple underscores into one
  sanitized = sanitized.replace(/_+/g, "_");

  // Trim underscores from start and end
  sanitized = sanitized.replace(/^_+|_+$/g, "");

  return sanitized;
}
/**
 * POST handler - Upload file
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "uploads";

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Sanitize the filename
    const safeName = sanitizeFileName(file.name);

    if (!safeName) {
      return NextResponse.json(
        { error: "Invalid filename after sanitization" },
        { status: 400 }
      );
    }

    // Build the path
    const path = `${folder}/${safeName}`;

    // Read file as ArrayBuffer and convert to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from("strickin-docs")
      .upload(path, buffer, {
        upsert: true,
        contentType: file.type,
      });

    if (error) {
      return NextResponse.json(
        { error: `Upload failed: ${error.message}` },
        { status: 500 }
      );
    }

    // Generate public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("strickin-docs").getPublicUrl(path);

    return NextResponse.json({
      success: true,
      path: data?.path,
      name: safeName,
      originalName: file.name,
      url: publicUrl,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: `Server error: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}

/**
 * DELETE handler - Remove file and related database records
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { path } = body;

    if (!path || typeof path !== "string") {
      return NextResponse.json(
        { error: "Path is required and must be a string" },
        { status: 400 }
      );
    }

    // Delete from storage bucket
    const { error: storageError } = await supabase.storage
      .from("strickin-docs")
      .remove([path]);

    if (storageError) {
      return NextResponse.json(
        { error: `Storage deletion failed: ${storageError.message}` },
        { status: 500 }
      );
    }

    // Delete from documents table where storage_path matches
    const { error: dbError } = await supabase
      .from("documents")
      .delete()
      .eq("storage_path", path);

    if (dbError) {
      console.error("Database deletion error:", dbError);
      // Don't fail the response if DB deletion fails, storage is already deleted
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json(
      { error: `Server error: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}

/**
 * GET handler - List files in a folder
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const folder = searchParams.get("folder") || "";

    // List files in the bucket
    const { data, error } = await supabase.storage
      .from("strickin-docs")
      .list(folder, {
        limit: 100,
        offset: 0,
        sortBy: { column: "created_at", order: "desc" },
      });

    if (error) {
      return NextResponse.json(
        { error: `List failed: ${error.message}` },
        { status: 500 }
      );
    }

    // Filter to only files (exclude folders which have id: null)
    const files = (data || [])
      .filter((item) => item.id !== null)
      .map((item) => ({
        name: item.name,
        size: item.metadata?.size || 0,
        type: item.metadata?.mimetype || "unknown",
        created_at: item.created_at,
      }));

    return NextResponse.json({
      files,
      count: files.length,
    });
  } catch (error) {
    console.error("List error:", error);
    return NextResponse.json(
      { error: `Server error: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}
