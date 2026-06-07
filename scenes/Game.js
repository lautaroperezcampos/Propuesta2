// URL to explain PHASER scene: https://rexrainbow.github.io/phaser3-rex-notes/docs/site/scene/

export default class Game extends Phaser.Scene {
  constructor() {
    super("game");
  }

  init(data) {
    this.score = data.score ?? 0;
    this.levelIndex = data.levelIndex ?? 0;
    this.collectedItems = 0;
    this.requiredItems = 5;
    this.levels = ["map1", "mapa2", "Mapa3"];
    this.tilesetFile = "public/assets/suelo.png";
    this.isLevelComplete = false;
  }

  preload() {
    // El mapa debe cargarse desde una ruta relativa dentro del proyecto web,
    // no desde una ruta absoluta de Windows.
    const levelKey = this.levels[this.levelIndex];
    this.load.tilemapTiledJSON(levelKey, `public/assets/tilemap/${levelKey}.json`);
    this.load.image("suelo", this.tilesetFile);
    this.load.image("star", "public/assets/star.png");

    this.load.spritesheet("dude", "public/assets/dude.png", {
      frameWidth: 32,
      frameHeight: 48,
    });
  }

  create() {
    if (this.levelIndex >= this.levels.length) {
      this.add.text(80, 200, "Â¡GANASTE TODO!", {
        fontSize: "48px",
        fill: "#ffffff",
      });
      this.add.text(80, 280, `Puntaje total: ${this.score}`, {
        fontSize: "32px",
        fill: "#ffffff",
      });
      return;
    }

    const levelKey = this.levels[this.levelIndex];
    console.log(`Creating level: ${levelKey} (index ${this.levelIndex})`);
    const map = this.make.tilemap({ key: levelKey });
    console.log(`Tilemap layers: ${map.layers.map(l => l.name).join(', ')}`);

    // Debug: show tilesets present in the loaded map
    console.log('Map tilesets (from JSON):', map.tilesets.map(t => t.name));

    // Parameters are the tileset name from the Tiled JSON and the key of the tileset image loaded in Phaser.
    const tilesetName = map.tilesets[0]?.name || "tile";
    const tileset = map.addTilesetImage(tilesetName, "suelo", 32, 32, 0, 0);
    console.log('Using tileset image key: suelo, tileset name in JSON:', tilesetName, { tileset });

    // Parameters: layer name (or index) from Tiled, tileset, x, y
    const worldLayer = map.createLayer("Capa de patrones 1", tileset, 0, 0);
    const objectsLayer = map.getObjectLayer("Capa de Objetos 1");
    console.log('World layer created:', !!worldLayer, 'objects layer count:', objectsLayer?.objects?.length ?? 0);
    try {
      const sampleTile = worldLayer.getTileAt(0, 0);
      console.log('Sample tile at (0,0):', sampleTile);
    } catch (e) {
      console.warn('No sample tile available or error reading tile:', e);
    }
    if (!objectsLayer) {
      console.error(`Object layer "Capa de Objetos 1" not found for ${levelKey}`);
    }
    console.log(`Objects in layer: ${objectsLayer?.objects?.length ?? 0}`);

    // Find in the Object Layer, the name "Player" and get position
    const spawnPoint =
      map.findObject("Capa de Objetos 1", (obj) => obj.name === "Player") || {
        x: 32,
        y: 32,
      };

    let finishPoint = map.findObject(
      "Capa de Objetos 1",
      (obj) => obj.name === "Finish"
    );

    if (!finishPoint && levelKey === "mapa2") {
      const proposedX = spawnPoint.x + map.tileWidth;
      finishPoint = {
        x: proposedX <= map.widthInPixels - map.tileWidth ? proposedX : spawnPoint.x - map.tileWidth,
        y: spawnPoint.y,
      };
      console.log(`Level 2 finish point placed near spawn: ${finishPoint.x}, ${finishPoint.y}`);
    }

    if (!finishPoint) {
      console.warn(`Finish object not found for level ${levelKey}. Using fallback finish point.`);
      if (levelKey === "Mapa3") {
        finishPoint = {
          x: map.widthInPixels - 64,
          y: map.tileHeight * 2,
        };
      } else {
        finishPoint = {
          x: map.widthInPixels - 64,
          y: map.tileHeight,
        };
      }
    }

    this.player = this.physics.add.sprite(spawnPoint.x, spawnPoint.y, "dude");
    this.player.setScale(0.7);
    this.player.body.setSize(18, 28);
    this.player.body.setOffset(7, 16);
    this.player.setBounce(0.2);
    this.player.setCollideWorldBounds(true);
    this.player.body.setGravityY(300);
    this.isMap3 = levelKey === "Mapa3";

    // Camera follow and bounds for larger levels
    this.cameras.main.startFollow(this.player);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    this.anims.create({
      key: "left",
      frames: this.anims.generateFrameNumbers("dude", { start: 0, end: 3 }),
      frameRate: 10,
      repeat: -1,
    });

    this.anims.create({
      key: "turn",
      frames: [{ key: "dude", frame: 4 }],
      frameRate: 20,
    });

    this.anims.create({
      key: "right",
      frames: this.anims.generateFrameNumbers("dude", { start: 5, end: 8 }),
      frameRate: 10,
      repeat: -1,
    });

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyR = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);

    worldLayer.setCollisionByExclusion([-1]);
    this.physics.add.collider(this.player, worldLayer);

    // Create empty group of stars
    this.stars = this.physics.add.group();

    objectsLayer.objects.forEach((objData) => {
      const { x = 0, y = 0, name } = objData;
      if (name === "Estrella") {
        const star = this.stars.create(x, y, "star");
        star.setBounceY(Phaser.Math.FloatBetween(0.4, 0.8));
      }
    });

    if (levelKey === "mapa2") {
      const wallSize = map.tileWidth;
      const mapW = map.widthInPixels;
      const mapH = map.heightInPixels;
      const invisibleWalls = [
        this.add.rectangle(-wallSize / 2, mapH / 2, wallSize, mapH + wallSize).setOrigin(0.5).setVisible(false),
        this.add.rectangle(mapW + wallSize / 2, mapH / 2, wallSize, mapH + wallSize).setOrigin(0.5).setVisible(false),
        this.add.rectangle(mapW / 2, -wallSize / 2, mapW + wallSize, wallSize).setOrigin(0.5).setVisible(false),
        this.add.rectangle(mapW / 2, mapH + wallSize / 2, mapW + wallSize, wallSize).setOrigin(0.5).setVisible(false),
      ];
      invisibleWalls.forEach((rect) => {
        this.physics.add.existing(rect, true);
        this.physics.add.collider(this.player, rect);
        this.physics.add.collider(this.stars, rect);
      });
      console.log('Invisible map2 boundary created:', invisibleWalls.length);
    }

    if (finishPoint) {
      const finish = this.add
        .rectangle(finishPoint.x, finishPoint.y, 24, 24, 0x00ff00, 0.5)
        .setOrigin(0.5, 0.5);
      this.physics.add.existing(finish, true);
      this.finishZone = finish;
      this.physics.add.overlap(this.player, this.finishZone, this.handleFinish, null, this);
    }

    this.physics.add.collider(
      this.player,
      this.stars,
      this.collectStar,
      null,
      this
    );
    this.physics.add.collider(this.stars, worldLayer);

    this.levelText = this.add.text(16, 16, `Nivel: ${this.levelIndex + 1}`, {
      fontSize: "24px",
      fill: "#ffffff",
    });

    this.scoreText = this.add.text(16, 46, `Score: ${this.score}`, {
      fontSize: "24px",
      fill: "#ffffff",
    });

    this.itemText = this.add.text(
      16,
      76,
      `Estrellas: ${this.collectedItems}/${this.requiredItems}`,
      {
        fontSize: "24px",
        fill: "#ffffff",
      }
    );

    this.messageText = this.add.text(16, 106, "", {
      fontSize: "20px",
      fill: "#ffff00",
    });
  }

  update() {
    // update game objects
    if (this.cursors.left.isDown) {
      this.player.setVelocityX(-160);

      this.player.anims.play("left", true);
    } else if (this.cursors.right.isDown) {
      this.player.setVelocityX(160);

      this.player.anims.play("right", true);
    } else {
      this.player.setVelocityX(0);

      this.player.anims.play("turn");
    }

    if (this.isMap3 && this.cursors.up.isDown) {
      this.player.setVelocityY(-240);
    } else if (this.cursors.up.isDown && this.player.body.blocked.down) {
      this.player.setVelocityY(-380);
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyR)) {
      console.log("Restarting current level", this.levelIndex);
      this.scene.start("game", {
        score: this.score,
        levelIndex: this.levelIndex,
      });
    }
  }

  handleFinish() {
    if (this.isLevelComplete) {
      return;
    }

    if (this.collectedItems >= this.requiredItems) {
      this.isLevelComplete = true;
      this.messageText.setText("Â¡Nivel completado! Cargando siguiente nivel...");

      this.time.delayedCall(1000, () => {
        const nextLevel = this.levelIndex + 1;
        if (nextLevel < this.levels.length) {
          console.log(`Level complete. Starting next level ${nextLevel}`);
          this.scene.start("game", {
            score: this.score,
            levelIndex: nextLevel,
          });
        } else {
          this.messageText.setText(`Â¡Ganaste todo! Puntaje total: ${this.score}`);
        }
      });
    } else {
      const remaining = this.requiredItems - this.collectedItems;
      this.messageText.setText(`Faltan ${remaining} estrellas para avanzar`);
    }
  }

  collectStar(player, star) {
    star.disableBody(true, true);

    this.score += 10;
    this.collectedItems += 1;
    this.scoreText.setText(`Score: ${this.score}`);
    this.itemText.setText(`Estrellas: ${this.collectedItems}/${this.requiredItems}`);

    if (this.stars.countActive(true) === 0) {
      //  A new batch of stars to collect
      this.stars.children.iterate(function (child) {
        child.enableBody(true, child.x, 0, true, true);
      });
    }
  }
}




