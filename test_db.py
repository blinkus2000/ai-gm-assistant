import sys
from src.storage import load_campaign, list_campaigns

def main():
    print("Listing campaigns:")
    campaigns = list_campaigns()
    for c in campaigns:
        print(f" - {c.id}: {c.name}")
    
    if not campaigns:
        print("No campaigns found.")
        sys.exit(1)
        
    c_id = campaigns[0].id
    print(f"\nLoading campaign {c_id}:")
    campaign = load_campaign(c_id)
    if campaign:
        print("Success! Setting:", repr(campaign.setting[:50] + "..."))
        print(f"NPCs: {len(campaign.npcs)}")
        print(f"Sessions: {len(campaign.sessions)}")
        print(f"Locations: {len(campaign.locations)}")
        print(f"Adversaries: {len(campaign.adversaries)}")
    else:
        print("Failed to load campaign.")
        sys.exit(1)

if __name__ == "__main__":
    main()
