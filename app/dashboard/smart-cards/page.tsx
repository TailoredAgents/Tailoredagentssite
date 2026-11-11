import type {Metadata} from 'next';
import {requireDashboardContext} from '@/lib/dashboard/data';
import {getCardsDashboard} from '@/lib/smart-cards/data';
import {SmartCardsDashboard} from '@/components/smart-cards/dashboard';
import './smart-cards.css';
export const metadata:Metadata={title:'Smart Cards'};
export default async function SmartCardsPage(){const context=await requireDashboardContext();const data=await getCardsDashboard(context);return <><header className="dashboard-topbar"><div><span>Workspace</span><strong>Smart Cards</strong></div></header><div className="dashboard-content"><section className="dashboard-page-heading"><div><span>Every introduction has a next step</span><h1>Smart Cards</h1><p>Your team’s digital profiles, permanent card links, and the conversations they start.</p></div></section><SmartCardsDashboard data={data}/></div></>;}
