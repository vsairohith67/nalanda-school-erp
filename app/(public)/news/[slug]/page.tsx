import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicBlocks } from "@/components/public-website";
import { prisma } from "@/lib/prisma";
import { getPublishedPublicPost, getPublishedPublicSettings } from "@/lib/public-website-content";
import { buildPublicMetadata } from "@/lib/public-website-seo";
export async function generateMetadata({ params }: { params: Promise<{slug:string}> }): Promise<Metadata> { const {slug}=await params; const [post,settings]=await Promise.all([getPublishedPublicPost(prisma,slug),getPublishedPublicSettings(prisma)]); return post ? buildPublicMetadata(post.seo,settings.publicSiteUrl) : { title:"Public update not found", robots:{index:false,follow:false} }; }
export default async function NewsDetail({params}:{params:Promise<{slug:string}>}){const{slug}=await params;const[post,settings]=await Promise.all([getPublishedPublicPost(prisma,slug),getPublishedPublicSettings(prisma)]);if(!post)notFound();return <article className="public-news-detail"><header><span>{post.postType}</span><h1>{post.title}</h1><p>{post.summary}</p><time dateTime={post.version.publishedAt.toISOString()}>{post.version.publishedAt.toLocaleDateString("en-IN",{dateStyle:"long",timeZone:"Asia/Kolkata"})}</time></header><PublicBlocks blocks={post.blocks} settings={settings}/></article>;}
