# Recorded Audio Sources

Zen Noise ships real recorded audio assets under `client/public/audio/`.

This pass prioritizes MP3 for browser compatibility, CC0/public-domain licensing where possible, and source-specific realism. Keep this file and `client/public/audio/audio-sources.json` with the repo when redistributing the app.

| App sound | Local file | Source | License / attribution | Research note |
| --- | --- | --- | --- | --- |
| Brown noise | `/audio/brown-noise.ogg` | [Brownnoise](https://commons.wikimedia.org/wiki/File:Brownnoise.ogg) | Public domain | Noise-color reference file. The app generates a local brown-noise fallback if a browser cannot decode the OGG. |
| Gentle rain | `/audio/rain.mp3` | [Gentle Rain from Window.wav](https://freesound.org/people/YostPeter/sounds/523405/) | [Creative Commons 0](https://creativecommons.org/publicdomain/zero/1.0/), YostPeter via Freesound | Gentle window rain patter with occasional distant road noise, less harsh than the prior heavier rain sample. |
| Coffee shop background | `/audio/coffee-shop.mp3` | [coffee shop ambience](https://freesound.org/people/waweee/sounds/370973/) | [Creative Commons 0](https://creativecommons.org/publicdomain/zero/1.0/), waweee via Freesound | Real cafeteria ambience recorded with Sound Devices 633 and Sennheiser K6 ME 66. |
| Gentle thunderstorms | `/audio/thunderstorm.mp3` | [Rain on metal roof with distant thunder](https://freesound.org/people/DBlover/sounds/404061/) | [Creative Commons 0](https://creativecommons.org/publicdomain/zero/1.0/), DBlover via Freesound | Distant thunder over rain, selected to avoid close cracks that can startle sleep users. |
| Soft winds | `/audio/wind.mp3` | [Soft Wind Trees Moving Ambience.wav](https://freesound.org/people/jordir/sounds/360568/) | [Creative Commons 0](https://creativecommons.org/publicdomain/zero/1.0/), jordir via Freesound | Dedicated soft wind-in-trees field recording; avoids baking birds into the wind layer. |
| Chirping birds | `/audio/birds.mp3` | [morning birds.mp3](https://freesound.org/people/royshavit/sounds/653915/) | [Creative Commons 0](https://creativecommons.org/publicdomain/zero/1.0/), royshavit via Freesound | MP3 birds layer so bird ambience is independently controlled from wind. |
| Crackling camp fire | `/audio/campfire.mp3` | [Campfire (Position 1)](https://freesound.org/people/SKrafft/sounds/681366/) | [Creative Commons 0](https://creativecommons.org/publicdomain/zero/1.0/), SKrafft via Freesound | Quiet nighttime campfire recording, replacing the prior CC BY 3.0 fire asset. |
| Tibetan bowl ringing | `/audio/tibetan-bowl.mp3` | [Tibetan singing bowl](https://freesound.org/people/enhuber/sounds/400819/) | [Creative Commons 0](https://creativecommons.org/publicdomain/zero/1.0/), enhuber via Freesound | Clean stereo bowl sample, replacing the prior CC BY-SA source to avoid share-alike friction. |
| Sleeping cat purr | `/audio/cat-purr.mp3` | [Cat Purr / gato ronroneando](https://freesound.org/people/yetcop/sounds/252645/) | [Creative Commons 0](https://creativecommons.org/publicdomain/zero/1.0/), yetcop via Freesound | Close real purr recording with recorder, date, and location details. |
| Forest rustling leaves | `/audio/forest-leaves.mp3` | [breeze.wav](https://freesound.org/people/keweldog/sounds/181801/) | [Creative Commons 0](https://creativecommons.org/publicdomain/zero/1.0/), keweldog via Freesound | Gentler breeze through pines, selected to replace the more aggressive rustling-leaves WAV. |
