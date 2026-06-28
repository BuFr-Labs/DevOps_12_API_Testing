# DevOps_12_API_Testing
Repozitoř k 12. lekci

# DevOps Úkol: Automatizované testování API v Postmanu a GitHub Actions

Tento repozitář obsahuje řešení zaměřené na automatizaci testování REST API pomocí nástroje Postman (Newman) a integraci do CI/CD pipeline na platformě GitHub.

## 🎯 Cíle projektu
* Vytvoření ucelené kolekce testů pro API (CRUD operace: Products, Carts, Users).
* Implementace dynamických dat v testech (využití proměnných a pre-request scriptů).
* Automatizace testování pomocí nástroje Newman v rámci GitHub Actions.
* Generování přehledných HTML reportů o stavu testů.

## 📂 Struktura projektu
* `ecommerce-api-collection.json` - Exportovaná Postman kolekce se všemi testy.
* `ecommerce-environment.json` - Konfigurace prostředí pro běh testů.
* `.github/workflows/api-tests.yml` - Definice CI/CD pipeline pro GitHub Actions.

## 🚀 Návod k použití

### 1. Spuštění lokálně (pomocí Newmana)
Pro lokální spuštění testů je nutné mít nainstalovaný Node.js a Newman:
```bash
npm install -g newman
npm install -g newman-reporter-htmlextra
```
Spuštění testovací sady:

```bash
newman run ecommerce-api-collection.json -e ecommerce-environment.json --reporters cli,htmlextra
```

### 2. CI/CD Automatizace
Testy se spouští automaticky při každém push do repozitáře. Výsledky jsou dostupné v záložce Actions na GitHubu.

## 📊 Výstupy
* **CLI Logy**: Výpis průběhu testů v terminálu.
* **HTML Report**: Podrobný report generovaný po každém běhu pipeline (dostupný jako artefakt v GitHub Actions).

## Známé problémy a analýza
* **Cloudflare 403 Forbidden:** Automatizované prostředí GitHub Actions je aktuálně blokováno ochranou API (Cloudflare). 
* **Analýza:** IP adresy GitHub runnerů jsou cíleně omezovány, aby se zabránilo scraping botům. 
* **Ověření:** Lokální spuštění přes Newman na lokální IP adrese je plně funkční, což potvrzuje korektnost implementace testů.