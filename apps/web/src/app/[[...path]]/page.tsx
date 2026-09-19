import { Workspace } from '@/components/workspace';
import { notFound } from 'next/navigation';
export default async function Page({params}:{params:Promise<{path?:string[]}>}){
  // Do not let the UI catch-all impersonate D's absent JSON API with HTTP 200 HTML.
  const {path}=await params;
  if(path?.[0]==='api')notFound();
  return <Workspace/>;
}
