// Local preview for the exact static export, including the GitHub Pages base path.
import {createServer} from "node:http";
import {readFile,stat} from "node:fs/promises";
import {resolve,extname,sep} from "node:path";
const root=resolve("out");const base=(process.env.NEXT_PUBLIC_BASE_PATH??"/numora").replace(/\/$/,"");
const mime={".html":"text/html; charset=utf-8",".js":"text/javascript",".css":"text/css",".json":"application/json",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",".ico":"image/x-icon",".woff2":"font/woff2",".txt":"text/plain"};
createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,"http://127.0.0.1:3000").pathname);
  if(pathname==="/"&&base){res.writeHead(302,{Location:base+"/"});res.end();return;}
  if(base&&pathname!==base&&!pathname.startsWith(base+"/"))throw new Error("NOT_FOUND");
  let file=resolve(root,"."+pathname.slice(base.length));
  if(file!==root&&!file.startsWith(root+sep))throw new Error("NOT_FOUND");
  if((await stat(file)).isDirectory())file=resolve(file,"index.html");
  res.writeHead(200,{"Content-Type":mime[extname(file)]??"application/octet-stream","Cache-Control":"no-store"});res.end(await readFile(file));
 }catch{res.writeHead(404,{"Content-Type":"text/plain"});res.end("Not found");}
}).listen(3000,"127.0.0.1",()=>console.log(`Static DEV preview: http://127.0.0.1:3000${base}/adm/`));
