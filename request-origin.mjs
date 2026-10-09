// Accept same-host browser requests over HTTP or HTTPS, including TLS proxies.
export function allowedOrigin(origin,host){
 if(!origin)return true;
 try{const url=new URL(origin);return ['http:','https:'].includes(url.protocol)&&url.host===host&&url.origin===origin;}catch{return false;}
}
