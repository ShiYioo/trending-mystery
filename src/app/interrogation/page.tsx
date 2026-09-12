import { redirect } from "next/navigation";

// 四个房间已搬进 TM-01 复古电脑的操作系统，旧路由一律回主页（开场即进入电脑）

export default function InterrogationRedirect() {
  redirect("/");
}
