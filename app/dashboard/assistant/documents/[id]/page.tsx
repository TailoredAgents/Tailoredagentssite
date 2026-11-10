import '../../assistant.css';
import {z} from 'zod';
import {notFound} from 'next/navigation';
import {AssistantDocumentDetail} from '@/components/assistant-documents';
export default async function DocumentPage({params}:{params:Promise<{id:string}>}){const parsed=z.uuid().safeParse((await params).id);if(!parsed.success)notFound();return <AssistantDocumentDetail id={parsed.data}/>;}
