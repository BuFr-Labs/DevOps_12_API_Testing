import requests

# Odeslu GET pozadavek na produkty
response = requests.get("https://fakestoreapi.com/products")

# Vypisu HTTP status kod (200 znamena OK)
print("Status kod:", response.status_code)

# Vypisu prvni produkt pro kontrolu struktury
produkty = response.json()
print("Prvni produkt v e-shopu:", produkty[0]["title"])