import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { projectName, files } = await req.json();
    if (!projectName || !files?.length) {
      return Response.json({ error: 'Missing projectName or files' }, { status: 400 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    // Create root project folder
    const folderRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: projectName,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });
    const folder = await folderRes.json();
    if (!folder.id) return Response.json({ error: 'Failed to create Drive folder', detail: folder }, { status: 500 });

    const rootFolderId = folder.id;

    // Cache of subfolder name -> Drive folder id
    const subfolderCache = {};

    const getOrCreateSubfolder = async (name, parentId) => {
      const cacheKey = `${parentId}/${name}`;
      if (subfolderCache[cacheKey]) return subfolderCache[cacheKey];
      const res = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentId],
        }),
      });
      const sf = await res.json();
      subfolderCache[cacheKey] = sf.id;
      return sf.id;
    };

    // Upload each file
    for (const { path, content } of files) {
      const parts = path.split('/');
      const filename = parts.pop();
      let parentId = rootFolderId;

      // Create intermediate folders
      for (const part of parts) {
        if (part) parentId = await getOrCreateSubfolder(part, parentId);
      }

      const metadata = JSON.stringify({ name: filename, parents: [parentId] });
      const fileContent = new TextEncoder().encode(content);

      const boundary = '-------314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const body = new TextEncoder().encode(
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        metadata +
        delimiter +
        'Content-Type: text/plain\r\n\r\n'
      );

      const combined = new Uint8Array(body.length + fileContent.length + new TextEncoder().encode(closeDelimiter).length);
      combined.set(body, 0);
      combined.set(fileContent, body.length);
      combined.set(new TextEncoder().encode(closeDelimiter), body.length + fileContent.length);

      await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          ...authHeader,
          'Content-Type': `multipart/related; boundary="${boundary}"`,
        },
        body: combined,
      });
    }

    const folderUrl = `https://drive.google.com/drive/folders/${rootFolderId}`;
    return Response.json({ folderUrl, folderId: rootFolderId });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});