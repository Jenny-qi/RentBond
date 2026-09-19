import type { Metadata } from 'next';
import { Provider } from '@/features/provider';
import './globals.css';
export const metadata:Metadata={title:'RentBond · 远程押金结算',description:'面向国际学生和小型房东的部分争议结算。测试资产，无现金价值。'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body><Provider>{children}</Provider></body></html>;}
