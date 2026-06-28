name: API Tests

on: [push]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      # stahni repozitar na runner
      - uses: actions/checkout@v3

      # nastav Node.js - pouzivame nativni https, zadne externi zavislosti
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      # spust testy pres vlastni runner - obchazi TLS bug v postman-request
      - name: Run API tests
        run: node run-collection.js ecommerce-api-collection.postman_collection.json ecommerce-environment.postman_environment.json