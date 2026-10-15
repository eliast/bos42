import {mkdirSync,chownSync} from 'node:fs';
if(process.getuid?.()===0){
  if(process.env.RAILWAY_VOLUME_MOUNT_PATH==='/data'){
    mkdirSync('/data/bos42',{recursive:true,mode:0o700});
    chownSync('/data/bos42',1000,1000);
    process.env.FLIGHT_STORY_PATH='/data/bos42/flight-story.json';
  }
  process.setgroups([]);process.setgid(1000);process.setuid(1000);
}
await import('./index.mjs');
