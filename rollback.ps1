<#
    dsh-corner-studio 一键回滚
    作用：移除插件链接，并还原安装前的 desktop profile 配置，然后提示重启。
    安全性：只删除指向插件目录的链接本身，不会删除插件源码。
#>
$ErrorActionPreference = 'Stop'
$profile = Join-Path $env:USERPROFILE '.dsh\profiles\desktop'

if (-not (Test-Path $profile)) {
    Write-Host "找不到 profile 目录：$profile" -ForegroundColor Red
    exit 1
}

# 1. 移除插件链接（只删链接，不删源码）
$link = Join-Path $profile 'node_modules\dsh-corner-studio'
if (Test-Path $link) {
    $item = Get-Item $link -Force
    if ($item.LinkType -eq 'Junction' -or $item.LinkType -eq 'SymbolicLink') {
        $item.Delete()
        Write-Host "已移除插件链接：$link" -ForegroundColor Green
    } else {
        Write-Host "警告：$link 不是链接而是实体目录，已跳过删除，请手动确认。" -ForegroundColor Yellow
    }
} else {
    Write-Host "插件链接不存在，跳过。"
}

# 2. 还原安装前的 package.json 备份
$backups = Get-ChildItem (Join-Path $profile 'package.json.bak-*') -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending
if ($backups.Count -gt 0) {
    $bak = $backups[0]
    Copy-Item $bak.FullName (Join-Path $profile 'package.json') -Force
    Write-Host "已还原 package.json（来自备份 $($bak.Name)）" -ForegroundColor Green
} else {
    Write-Host "没有找到 package.json 备份，请手动从 package.json 的 dependencies 与 dsh.profile.bundles 中删除 dsh-corner-studio。" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "完成。请重启 DSH 桌面端使改动生效。" -ForegroundColor Cyan
