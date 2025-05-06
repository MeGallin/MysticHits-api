Thought for 7 seconds

**📂 Members-Area Module – Detailed Tickets & Code**

Below is a complete ticket backlog (backend + frontend), schema update, controller code, routes, and React stubs for letting **registered users** save folder/URL routes and play them — while admins can view/manage everyone’s folders.

**1 Schema Extension**

// models/User.js (add to existing schema)

const folderSchema = new mongoose.Schema(

{

label: { type: String, required: true },

path: { type: String, required: true }, // local sub-path OR remote URL

created: { type: Date, default: Date.now }

},

{ \_id: true }

);

UserSchema.add({ folders: [folderSchema] });

**Migration:** nothing to run — existing users get folders: [].

**2 Backend**

**2.1 Access helper**

function assertOwnerOrAdmin(req, ownerId) {

if (ownerId.toString() !== req.userId && !req.isAdmin) {

return res.status(403).json({ error: 'Forbidden' });

}

}

**2.2 Controllers (controllers/folderController.js)**

const User = require('../models/User');

const { validateUrl, validateFolderPath } = require('../controllers/playlistController');

exports.listFolders = async (req, res) =\> {

const { uid } = req.params; // optional (admin view)

const targetId = uid ?? req.userId;

if (uid) assertOwnerOrAdmin(req, uid);

const user = await User.findById(targetId, 'folders');

res.json(user.folders);

};

exports.addFolder = async (req,res)=\>{

const { label, path } = req.body;

if (!label \|\| !path) return res.status(400).json({ error:'label & path required' });

// quick validation

try {

path.startsWith('http') ? validateUrl(path) : validateFolderPath(path);

} catch (e) { return res.status(400).json({ error:e.message }); }

const user = await User.findByIdAndUpdate(

req.userId,

{ \$push:{ folders:{ label, path } } },

{ new:true, select:'folders', projection:{ folders:{ \$slice:-1 } } }

);

res.status(201).json(user.folders[0]);

};

exports.updateFolder = async (req,res)=\>{

const { id } = req.params;

const { label, path } = req.body;

const user = await User.findOne(

{ \_id:req.userId, 'folders._id':id },

{ 'folders.\$': 1 }

);

if (!user) return res.status(404).json({ error:'Folder not found' });

// owner check done — admin can update any following route

await User.updateOne(

{ 'folders._id': id },

{ \$set:{

'folders.\$.label': label ?? user.folders[0].label,

'folders.\$.path' : path ?? user.folders[0].path

}}

);

res.json({ success:true });

};

exports.deleteFolder = async (req,res)=\>{

const { id } = req.params;

const user = await User.findOne({ 'folders._id': id }, 'folders.\$');

if (!user) return res.status(404).json({ error:'Folder not found' });

assertOwnerOrAdmin(req, user._id);

await User.updateOne({ \_id:user._id }, { \$pull:{ folders:{ \_id:id } }});

res.json({ success:true });

};

/\* Playlist proxy — uses existing helpers \*/

exports.playFolder = async (req,res)=\>{

const { id } = req.params;

const user = await User.findOne({ 'folders._id': id }, 'folders.\$');

if (!user) return res.status(404).json({ error:'Folder not found' });

assertOwnerOrAdmin(req, user._id);

const { path } = user.folders[0];

const tracks = path.startsWith('http')

? await exports.getPlaylistFromRemoteFolder(path)

: await exports.getPlaylistFromLocalFolder(path, req);

res.json({ success:true, count:tracks.length, data:tracks });

};

**2.3 Routes (routes/folders.js)**

const router = require('express').Router();

const auth = require('../middleware/auth');

const admin = require('../middleware/admin');

const ctrl = require('../controllers/folderController');

router.use(auth); // JWT required

router.get('/', ctrl.listFolders); // own folders

router.post('/', ctrl.addFolder);

router.patch('/:id', ctrl.updateFolder);

router.delete('/:id', ctrl.deleteFolder);

router.get('/:id/playlist', ctrl.playFolder);

// ADMIN: view any user’s folders

router.get('/user/:uid', admin, ctrl.listFolders);

module.exports = router;

*Mount* in server.js → app.use('/api/user/folders', require('./routes/folders'));

**3 Frontend (React + Jotai + shadcn)**

**3.1 Atoms**

export const foldersAtom = atom\<Folder[]\>([]);

**3.2 FolderList component**

function FolderList() {

const [folders, setFolders] = useAtom(foldersAtom);

const { data } = useSWR('/api/user/folders', fetcher);

useEffect(()=\>data && setFolders(data), [data]);

const play = id =\> navigate(\`/player?fid=\${id}\`);

const del = async id=\>{

if (!confirm('Delete this folder?')) return;

await fetch(\`/api/user/folders/\${id}\`, { method:'DELETE', headers:authHeader() });

setFolders(folders.filter(f=\>f._id!==id));

};

return (

\<div className="grid md:grid-cols-2 gap-4"\>

{folders.map(f=\>(

\<Card key={f._id}\>

\<h3 className="font-semibold"\>{f.label}\</h3\>

\<p className="text-xs break-all"\>{f.path}\</p\>

\<div className="flex gap-2 mt-3"\>

\<Button size="sm" onClick={()=\>play(f._id)}\>Play\</Button\>

\<Button size="sm" variant="outline" onClick={()=\>openEdit(f)}\>Edit\</Button\>

\<Button size="sm" variant="destructive" onClick={()=\>del(f._id)}\>Del\</Button\>

\</div\>

\</Card\>

))}

\<Card className="flex items-center justify-center"\>

\<Button onClick={openAdd}\>＋ Add Folder\</Button\>

\</Card\>

\</div\>

);

}

**3.3 Player tweak**

On /player page:

const fid = new URLSearchParams(location.search).get('fid');

if (fid) fetch(\`/api/user/folders/\${fid}/playlist\`).then(setPlaylist);

**4 Ticket Backlog (with tests)**

| **Ticket**  | **Description**                          | **Tests**                                             |
|-------------|------------------------------------------|-------------------------------------------------------|
| **UA-1**    | Extend User schema with folders[]        | Mongoose unit test – default empty array              |
| **UA-2**    | GET/POST/PATCH/DELETE /api/user/folders  | Supertest: CRUD happy path + validation failures      |
| **UA-3**    | Owner vs admin guard helper              | Supertest: 403 when non-owner edits                   |
| **UA-4**    | GET /api/user/folders/:id/playlist proxy | Supertest: returns playlist JSON                      |
| **UI-1**    | foldersAtom + SWR fetch                  | RTL: renders list from mock JSON                      |
| **UI-2**    | Add/Edit modal form                      | RTL: validation + POST/PATCH stub                     |
| **UI-3**    | Play link → loads playlist               | RTL: param fid triggers fetch & Jotai playlist update |
| **ADMIN-1** | Admin view /admin/users/:uid/folders     | Route + table; test admin-only guard                  |

**✅ Definition of Done**

-   Regular users can add/rename/delete/play their own folders via UI.
-   Admin can view & manage any user’s folders.
-   All endpoints pass Jest / Supertest; front-end passes RTL.
-   Paths are validated with existing helpers, preventing malformed URLs.
-   Max 50 folders/user enforced (\$size check in controller).

Kick off **UA-1** and **UA-2** first to unblock UI work; once those tests are green, wire up the React components. Happy building!
