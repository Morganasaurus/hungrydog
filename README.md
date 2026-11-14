# HungryDog

How much should your dog eat? HungryDog reads the feeding guide on your dog's food and gives you a daily amount
in grams, per meal, for one food or a mix of two (like wet with dry).

- **Adults and seniors**: enter current and target weight. Amounts are for the target weight, with a safe timeline
  if your dog needs to lose or gain.
- **Puppies**: enter weight now and expected adult weight. Amounts come from the label's puppy table, with a heads-up
  when it's time to move to adult food.
- **Food not listed?** Enter the energy from the bag or can (kcal or kJ) and HungryDog works it out from calories.
- Works on phones, tablets and desktops. Nothing you enter leaves your device.

HungryDog gives a starting point, not veterinary advice. Weigh your dog regularly and adjust, and ask your vet
about puppies, pregnant or nursing dogs, and dogs with health problems.

## Development

```bash
npm install
npm run dev     # http://localhost:5174
npm test
npm run build
```

Foods live in `src/data/foods/`, one JSON file per product, checked by the tests. See `CLAUDE.md` for how the
calculations work.

## Running it

The image is built by GitHub Actions and published to `ghcr.io/morganasaurus/hungrydog`. Run it with the included
`docker-compose.yml` (serves on port 8097). The container runs nginx as a non-root user with a read-only file system.
