import '../../assistant.css';
import {notFound} from 'next/navigation';
import {z} from 'zod';
import {AssistantKnowledge} from '@/components/assistant-knowledge';
export default async function KnowledgePage({params}:{params:Promise<{id:string}>}){const id=z.uuid().safeParse((await params).id);if(!id.success)notFound();return <AssistantKnowledge id={id.data}/>;}
