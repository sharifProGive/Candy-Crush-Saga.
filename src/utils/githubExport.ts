import JSZip from 'jszip';

export type ExportPackageKind = 'static' | 'source';

export interface GitHubPushParams {
  packageKind: ExportPackageKind;
  owner: string;
  repo: string;
  branch: string;
  token: string;
  onProgress: (message: string, percent: number) => void;
}

export interface GitHubPushResult {
  commitUrl: string;
  repoUrl: string;
  pagesUrl: string;
  branch: string;
  fileCount: number;
}

const AUDIO_ASSET_PATHS: string[] = [
  'assets/aistudio/1_5597b470.mp3',
  'assets/aistudio/2_e94f2a79.mp3',
  'assets/audio/voice/awesome.mp3',
  'assets/audio/voice/color_bomb.mp3',
  'assets/audio/voice/combo.mp3',
  'assets/audio/voice/delicious.mp3',
  'assets/audio/voice/divine.mp3',
  'assets/audio/voice/excellent.mp3',
  'assets/audio/voice/fantastic.mp3',
  'assets/audio/voice/incredible.mp3',
  'assets/audio/voice/marvelous.mp3',
  'assets/audio/voice/striped_candy.mp3',
  'assets/audio/voice/sugar_crush.mp3',
  'assets/audio/voice/sweet.mp3',
  'assets/audio/voice/tasty.mp3',
  'assets/audio/voice/ultimate.mp3',
  'assets/audio/voice/wrapped_candy.mp3',
];

async function buildCompleteZip(
  kind: ExportPackageKind,
  onProgress?: (msg: string, pct: number) => void
): Promise<JSZip> {
  const baseUrl = kind === 'static' ? './downloads/code-static.zip' : './downloads/code-source.zip';
  onProgress?.('Loading game code bundle...', 5);

  const res = await fetch(baseUrl, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Could not load code archive (HTTP ${res.status}).`);
  }
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    throw new Error('Archive endpoint returned HTML instead of a ZIP file.');
  }

  const zip = await JSZip.loadAsync(await res.arrayBuffer());
  const prefix = kind === 'source' ? 'public/' : '';

  onProgress?.('Bundling music & 15 voice clips...', 12);
  await Promise.all(
    AUDIO_ASSET_PATHS.map(async (relPath) => {
      const audioRes = await fetch(`./${relPath}`);
      if (!audioRes.ok) {
        throw new Error(`Missing audio asset: ${relPath}`);
      }
      const buf = await audioRes.arrayBuffer();
      zip.file(`${prefix}${relPath}`, buf, { compression: 'STORE' });
    })
  );

  return zip;
}

export async function downloadZipFromPreview(
  kind: ExportPackageKind,
  filename: string
): Promise<void> {
  const zip = await buildCompleteZip(kind);
  const blob = await zip.generateAsync({ type: 'blob' });
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
}

async function ghFetch(path: string, token: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token.trim()}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
}

async function parseGhError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string };
    return data.message || `GitHub API error (${res.status})`;
  } catch {
    return `GitHub API error (${res.status})`;
  }
}

export async function pushZipToGitHub({
  packageKind,
  owner,
  repo,
  branch,
  token,
  onProgress,
}: GitHubPushParams): Promise<GitHubPushResult> {
  const cleanOwner = owner.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\/.*$/, '');
  const cleanRepo = repo
    .trim()
    .replace(/^https?:\/\/github\.com\/[^/]+\//i, '')
    .replace(/\.git$/i, '')
    .replace(/\/.*$/, '');
  let targetBranch = branch.trim() || 'main';

  if (!cleanOwner || !cleanRepo || !token.trim()) {
    throw new Error('Please enter your GitHub Username, Repository Name, and Personal Access Token.');
  }

  const zip = await buildCompleteZip(packageKind, onProgress);

  const fileEntries: Array<{ path: string; entry: JSZip.JSZipObject }> = [];
  zip.forEach((relativePath, zipEntry) => {
    if (!zipEntry.dir) {
      fileEntries.push({ path: relativePath, entry: zipEntry });
    }
  });

  if (fileEntries.length === 0) {
    throw new Error('Archive contains no files.');
  }

  onProgress(`Verifying ${cleanOwner}/${cleanRepo}...`, 16);
  const repoRes = await ghFetch(`/repos/${cleanOwner}/${cleanRepo}`, token);
  if (!repoRes.ok) {
    throw new Error(`Repository access failed: ${await parseGhError(repoRes)}`);
  }
  const repoInfo = (await repoRes.json()) as { default_branch?: string; html_url: string };
  if (!branch.trim() && repoInfo.default_branch) {
    targetBranch = repoInfo.default_branch;
  }

  let refRes = await ghFetch(`/repos/${cleanOwner}/${cleanRepo}/git/ref/heads/${targetBranch}`, token);
  if (refRes.status === 404 || refRes.status === 409) {
    onProgress('Initializing empty repository...', 20);
    const initRes = await ghFetch(`/repos/${cleanOwner}/${cleanRepo}/contents/.gitkeep`, token, {
      method: 'PUT',
      body: JSON.stringify({
        message: 'Initialize repository',
        content: '',
        branch: targetBranch,
      }),
    });
    if (!initRes.ok) {
      throw new Error(`Could not initialize branch '${targetBranch}': ${await parseGhError(initRes)}`);
    }
    refRes = await ghFetch(`/repos/${cleanOwner}/${cleanRepo}/git/ref/heads/${targetBranch}`, token);
  }

  if (!refRes.ok) {
    throw new Error(`Could not read branch '${targetBranch}': ${await parseGhError(refRes)}`);
  }

  const refData = (await refRes.json()) as { object: { sha: string } };
  const parentCommitSha = refData.object.sha;

  const commitRes = await ghFetch(`/repos/${cleanOwner}/${cleanRepo}/git/commits/${parentCommitSha}`, token);
  if (!commitRes.ok) {
    throw new Error(`Could not read parent commit: ${await parseGhError(commitRes)}`);
  }
  const commitData = (await commitRes.json()) as { tree: { sha: string } };
  const baseTreeSha = commitData.tree.sha;

  const treeItems: Array<{ path: string; mode: '100644'; type: 'blob'; sha: string }> = [];
  const total = fileEntries.length;
  const batchSize = 4;

  for (let i = 0; i < total; i += batchSize) {
    const batch = fileEntries.slice(i, i + batchSize);
    const uploaded = await Promise.all(
      batch.map(async ({ path, entry }) => {
        const base64Content = await entry.async('base64');
        const blobRes = await ghFetch(`/repos/${cleanOwner}/${cleanRepo}/git/blobs`, token, {
          method: 'POST',
          body: JSON.stringify({
            content: base64Content,
            encoding: 'base64',
          }),
        });
        if (!blobRes.ok) {
          throw new Error(`Failed uploading ${path}: ${await parseGhError(blobRes)}`);
        }
        const blobData = (await blobRes.json()) as { sha: string };
        return {
          path,
          mode: '100644' as const,
          type: 'blob' as const,
          sha: blobData.sha,
        };
      })
    );
    treeItems.push(...uploaded);
    const done = Math.min(total, i + batch.length);
    const pct = 22 + Math.round((done / total) * 64);
    onProgress(`Uploading files (${done}/${total})...`, pct);
  }

  onProgress('Creating Git tree...', 89);
  const treeRes = await ghFetch(`/repos/${cleanOwner}/${cleanRepo}/git/trees`, token, {
    method: 'POST',
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: treeItems,
    }),
  });
  if (!treeRes.ok) {
    throw new Error(`Tree creation failed: ${await parseGhError(treeRes)}`);
  }
  const treeData = (await treeRes.json()) as { sha: string };

  onProgress('Committing changes...', 94);
  const newCommitRes = await ghFetch(`/repos/${cleanOwner}/${cleanRepo}/git/commits`, token, {
    method: 'POST',
    body: JSON.stringify({
      message: 'Push Candy Crush Match-3 Saga project',
      tree: treeData.sha,
      parents: [parentCommitSha],
    }),
  });
  if (!newCommitRes.ok) {
    throw new Error(`Commit failed: ${await parseGhError(newCommitRes)}`);
  }
  const newCommitData = (await newCommitRes.json()) as { sha: string; html_url: string };

  onProgress('Updating branch...', 98);
  const updateRefRes = await ghFetch(
    `/repos/${cleanOwner}/${cleanRepo}/git/refs/heads/${targetBranch}`,
    token,
    {
      method: 'PATCH',
      body: JSON.stringify({ sha: newCommitData.sha }),
    }
  );
  if (!updateRefRes.ok) {
    throw new Error(`Branch push failed: ${await parseGhError(updateRefRes)}`);
  }

  onProgress('Pushed successfully!', 100);
  return {
    commitUrl: newCommitData.html_url,
    repoUrl: repoInfo.html_url,
    pagesUrl: `https://${cleanOwner}.github.io/${cleanRepo}/`,
    branch: targetBranch,
    fileCount: total,
  };
}
