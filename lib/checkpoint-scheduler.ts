/** Keep serialization off the keypress path, with a bounded delay during continuous typing. */
export function createCheckpointScheduler(write:()=>void,delay=250,maxWait=1000) {
  let idle:ReturnType<typeof setTimeout>|undefined,deadline:ReturnType<typeof setTimeout>|undefined;
  const cancel=()=>{clearTimeout(idle);clearTimeout(deadline);idle=undefined;deadline=undefined;};
  const flush=()=>{cancel();write();};
  return {
    schedule(){clearTimeout(idle);idle=setTimeout(flush,delay);if(deadline===undefined)deadline=setTimeout(flush,maxWait);},
    flush,cancel,
  };
}
