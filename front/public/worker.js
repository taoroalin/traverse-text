const getIn=(t,o)=>{let r=store;for(let e=0;e<t.length-o;e++)void 0===r[t[e]]&&(r[t[e]]={}),r=r[t[e]];return r},doEdits=e=>{if(e.subtract)for(var t of e.subtract){const d=getIn(t,2);var o=t[t.length-2];d[o]=d[o].filter(e=>e!=t[t.length-1])}if(e.write)for(var r of e.write){const c=getIn(r,2);c[r[r.length-2]]=r[r.length-1]}if(e.add)for(var s of e.add){const g=getIn(s,2);g[s[s.length-2]].push(s[s.length-1])}if(e.insert)for(var n of e.insert){const u=getIn(n,3);var i=n[n.length-3],a=n[n.length-2],n=n[n.length-1];let e=u[i];if(void 0===e)e=[a],u[i]=e;else{if(e.length<n)throw console.log(e),console.log(i),new Error("tried to insert past end of list");u[i]=e.slice(0,n),u[i].push(a),u[i].push(...e.slice(n))}}if(e.delete)for(var l of e.delete){const v=getIn(l,1);delete v[l[l.length-1]]}},print=e=>{user.logging&&console.log(e)};let idb=null,store=null,saveTimeout=null,user=null;const dbReq=indexedDB.open("microroam",4);dbReq.onsuccess=e=>idb=e.target.result,onmessage=e=>{var t=e.data[0];const o=e.data[1];"user"===t?user=o:"save"===t?(store=o,debouncedSaveStore()):"command"===t?(commands[o[0]](...o.slice(1)),debouncedSaveStore(),print(`ran command ${JSON.stringify(o)}`)):"edits"===t?(print(o),doEdits(o),debouncedSaveStore()):"ping"===t&&postMessage(["ping",void 0]),print(`saveWorker got weird operation: ${t}`)};const debouncedSaveStore=()=>{clearTimeout(saveTimeout),saveTimeout=setTimeout(saveStore,100)},saveStore=()=>{const e=idb.transaction(["stores"],"readwrite"),t=e.objectStore("stores");var o=JSON.stringify(store);const r=t.put({graphName:store.graphName,store:o});r.onsuccess=()=>{print("saved")},r.onerror=e=>{print("save error")}};