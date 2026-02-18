import configparser
import httpx
import re

config = configparser.ConfigParser()
config.read("config.ini")
STEAM_API_KEY = config["steam"]["api_key"]


def extract_steam64_id(profile_url: str) -> str | None:
    """
    Accepts:
      https://steamcommunity.com/profiles/76561198XXXXXXXXX
      https://steamcommunity.com/id/vanityname
    Returns Steam64 ID string or None.
    """
    profile_match = re.search(r"/profiles/(\d+)", profile_url)
    if profile_match:
        return profile_match.group(1)

    vanity_match = re.search(r"/id/([^/]+)", profile_url)
    if vanity_match:
        return None  # resolve below


async def resolve_vanity_url(vanity_name: str) -> str | None:
    url = "https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, params={"key": STEAM_API_KEY, "vanityurl": vanity_name})
        data = resp.json()
        if data["response"]["success"] == 1:
            return data["response"]["steamid"]
    return None


async def get_steam64_from_url(profile_url: str) -> str | None:
    profile_match = re.search(r"/profiles/(\d+)", profile_url)
    if profile_match:
        return profile_match.group(1)

    vanity_match = re.search(r"/id/([^/]+)", profile_url)
    if vanity_match:
        return await resolve_vanity_url(vanity_match.group(1))

    return None


async def get_ban_info(steam64_id: str) -> dict:
    """
    Returns ban info for a given Steam64 ID.
    {
        "VACBanned": bool,
        "NumberOfVACBans": int,
        "NumberOfGameBans": int,
        "CommunityBanned": bool,
        "DaysSinceLastBan": int
    }
    """
    url = "https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, params={"key": STEAM_API_KEY, "steamids": steam64_id})
        data = resp.json()
        if data.get("players"):
            p = data["players"][0]
            return {
                "VACBanned":          p.get("VACBanned", False),
                "NumberOfVACBans":    p.get("NumberOfVACBans", 0),
                "NumberOfGameBans":   p.get("NumberOfGameBans", 0),
                "CommunityBanned":    p.get("CommunityBanned", False),
                "DaysSinceLastBan":   p.get("DaysSinceLastBan", 0),
                "total_bans":         p.get("NumberOfVACBans", 0) + p.get("NumberOfGameBans", 0),
            }
    return {}


async def get_ban_count_from_url(profile_url: str) -> int:
    steam_id = await get_steam64_from_url(profile_url)
    if not steam_id:
        return 0
    info = await get_ban_info(steam_id)
    return info.get("total_bans", 0)
