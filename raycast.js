const TILE_SIZE = 80;
const MAP_NUM_ROWS = 11;
const MAP_NUM_COLS = 15;

const WINDOW_WIDTH = MAP_NUM_COLS * TILE_SIZE;
const WINDOW_HEIGHT = MAP_NUM_ROWS * TILE_SIZE;

const FOV_ANGLE = 70 * (Math.PI / 180);

const WALL_STRIP_WIDTH = 2; // ajustable
const NUM_RAYS = WINDOW_WIDTH / WALL_STRIP_WIDTH;

const MINIMAP_SCALE_FACTOR = 0.2;

class Map {
  constructor() {
    this.grid = [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
      [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1],
      [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    ];
  }
  hasWallAt(x, y) {
    if (x < 0 || x > WINDOW_WIDTH || y < 0 || y > WINDOW_HEIGHT) {
      return true;
    }
    var mapGridIndexX = Math.floor(x / TILE_SIZE);
    var mapGridIndexY = Math.floor(y / TILE_SIZE);
    // order is reversed because indexing the grid is in reverse considering list indexing
    return this.grid[mapGridIndexY][mapGridIndexX] != 0 ? true : false;
  }
  render() {
    for (var i = 0; i < MAP_NUM_ROWS; i++) {
      for (var j = 0; j < MAP_NUM_COLS; j++) {
        var tileY = i * TILE_SIZE;
        var tileX = j * TILE_SIZE;
        var tileColor = this.grid[i][j] == 1 ? "#555" : "#FFF";
        stroke("#222");
        fill(tileColor);
        rect(
          MINIMAP_SCALE_FACTOR * tileX,
          MINIMAP_SCALE_FACTOR * tileY,
          MINIMAP_SCALE_FACTOR * TILE_SIZE,
          MINIMAP_SCALE_FACTOR * TILE_SIZE
        );
      }
    }
  }
}

class Player {
  constructor() {
    // player will initialize in the middle of the map, thus the dividing by 2
    this.x = WINDOW_WIDTH / 2;
    this.y = WINDOW_HEIGHT / 2;
    this.radius = 5;
    this.turnDirection = 0; // -1 if left and 1 if right
    this.walkDirection = 0; // -1 if back and 1 if forward
    this.rotationAngle = Math.PI / 2; // pi/2 in radians = 90 degrees
    this.moveSpeed = 6.0; //2 pixels per frame
    this.rotationSpeed = 4 * (Math.PI / 180); // two degrees per frame but in radians
  }
  update() {
    // TODO: update player position based on turnDirection and walkDirection
    this.rotationAngle += this.turnDirection * this.rotationSpeed;
    var moveStep = this.walkDirection * this.moveSpeed;
    var newPlayerX = this.x + Math.cos(this.rotationAngle) * moveStep;
    var newPlayerY = this.y + Math.sin(this.rotationAngle) * moveStep;

    if (!grid.hasWallAt(newPlayerX, newPlayerY)) {
      this.x = newPlayerX;
      this.y = newPlayerY;
    }
  }
  render() {
    // noStroke();
    fill("red");
    circle(
      MINIMAP_SCALE_FACTOR * this.x,
      MINIMAP_SCALE_FACTOR * this.y,
      MINIMAP_SCALE_FACTOR * this.radius
    );
    stroke("red");
    // default render is a circle but we want a line to show the direction the player is facing
    line(
      MINIMAP_SCALE_FACTOR * this.x,
      MINIMAP_SCALE_FACTOR * this.y,
      // see 11:50 of video 10
      // think unit circle
      MINIMAP_SCALE_FACTOR * (this.x + Math.cos(this.rotationAngle) * 30),
      MINIMAP_SCALE_FACTOR * (this.y + Math.sin(this.rotationAngle) * 30)
    );
  }
}

class Ray {
  constructor(rayAngle) {
    // initalize with parameter
    this.rayAngle = normalizeAngle(rayAngle); // normalizeAngle sanitzes it by keeping it bound to 360 degrees or 2π
    this.wallHitX = 0;
    this.wallHitY = 0;
    this.distance = 0;
    this.wasHitVertical = false;

    // to find the intercepts for the cast method, we must take into account the different
    // directions the player may be faceing:
    // up & left
    // up & right
    // down & right
    // down & left
    this.isRayFacingDown = this.rayAngle > 0 && this.rayAngle < Math.PI; // the ray is facing down if it is > 0, it's and less < π
    this.isRayFacingUp = !this.isRayFacingDown;
    // this.isRayFacingRight = this.rayAngle > (3 * Math.PI) / 2 || this.rayAngle > 0;
    this.isRayFacingRight =
      this.rayAngle < 0.5 * Math.PI || this.rayAngle > 1.5 * Math.PI;
    this.isRayFacingLeft = !this.isRayFacingRight;
  }
  // the meaty ray.cast method
  cast() {
    var xintercept, yintercept;
    var deltaX, deltaY;
    //! //////////////////////////////////////
    //! HORIZONTAL RAY-GRID INTERSECTION CODE
    //! //////////////////////////////////////
    var foundHorizonalWallHit = false;
    var horizontalWallHitX,
      horizontalWallHitY = 0;

    // Find the y-cordinate of the closest horizontal
    yintercept = Math.floor(player.y / TILE_SIZE) * TILE_SIZE;
    yintercept += this.isRayFacingDown ? TILE_SIZE : 0;

    // Find the x-cordinate of the closest horizontal
    xintercept = player.x + (yintercept - player.y) / Math.tan(this.rayAngle);

    // calculate the increment deltaX and deltaY
    deltaY = TILE_SIZE;
    deltaY *= this.isRayFacingUp ? -1 : 1; // invert if ray is up

    deltaX = TILE_SIZE / Math.tan(this.rayAngle); // //? should TILE_SIZE be deltaY?
    deltaX *= this.isRayFacingLeft && deltaX > 0 ? -1 : 1;
    deltaX *= this.isRayFacingRight && deltaX < 0 ? -1 : 1;

    var nextHorizontalTouchX = xintercept;
    var nextHorizontalTouchY = yintercept;
    // to figure out if the intercept is on a wall we must either add or subtract to the
    // point of intersection based what direction the ray is facing. For example, if the
    // ray is facing up, then we subtract 1 one pixel, thus forcing that interection to
    // be inside of the cell where we can call it a wall

    // increment deltaX and deltaY untill we find a wall
    while (
      nextHorizontalTouchX >= 0 &&
      nextHorizontalTouchX <= WINDOW_WIDTH &&
      nextHorizontalTouchY >= 0 &&
      nextHorizontalTouchY <= WINDOW_HEIGHT
    ) {
      if (
        grid.hasWallAt(
          nextHorizontalTouchX,
          nextHorizontalTouchY - (this.isRayFacingUp ? 1 : 0)
        )
      ) {
        foundHorizonalWallHit = true;
        horizontalWallHitX = nextHorizontalTouchX;
        horizontalWallHitY = nextHorizontalTouchY;

        break;
        // WE FOUND A WALL
      } else {
        // otherwise we keep increamenting by deltaX and deltaY
        nextHorizontalTouchX += deltaX;
        nextHorizontalTouchY += deltaY;
      }
    }
    //! //////////////////////////////////////
    //! VERTICAL RAY-GRID INTERSECTION CODE
    //! //////////////////////////////////////
    var foundVerticalWallHit = false;
    var verticalWallHitX = 0;
    var verticalWallHitY = 0;

    // Find the X-cordinate!! of the closest Vertical grid intersection

    xintercept = Math.floor(player.x / TILE_SIZE) * TILE_SIZE;
    xintercept += this.isRayFacingRight ? TILE_SIZE : 0; //is facing right instead of down, image we've rotated our logic

    // Find the y-cordinate!! of the closest Vertical grid intersection
    // instead of dividing by the tan(α), we multipy by the adjecent, instead of the opposite
    yintercept = player.y + (xintercept - player.x) * Math.tan(this.rayAngle); // getting the adjecent side to get he opposite side

    // calculate the increment deltaX and deltaY
    deltaX = TILE_SIZE;
    // up before
    deltaX *= this.isRayFacingLeft ? -1 : 1; // invert if ray is up

    deltaY = TILE_SIZE * Math.tan(this.rayAngle); // //? should TILE_SIZE be deltaY?
    deltaY *= this.isRayFacingUp && deltaY > 0 ? -1 : 1; // instead of left we check for up
    deltaY *= this.isRayFacingDown && deltaY < 0 ? -1 : 1; // instead of right we check for down

    var nextVerticalTouchX = xintercept;
    var nextVerticalTouchY = yintercept;
    // to figure out if the intercept is on a wall we must either add or subtract to the
    // point of intersection based what direction the ray is facing. Here we check if
    // the ray is facing left, if so, we decrement once in X

    // increment deltaX and deltaY untill we find a wall
    while (
      nextVerticalTouchX >= 0 &&
      nextVerticalTouchX <= WINDOW_WIDTH &&
      nextVerticalTouchY >= 0 &&
      nextVerticalTouchY <= WINDOW_HEIGHT
    ) {
      if (
        grid.hasWallAt(
          nextVerticalTouchX - (this.isRayFacingLeft ? 1 : 0),
          nextVerticalTouchY
        )
      ) {
        foundVerticalWallHit = true;
        verticalWallHitX = nextVerticalTouchX;
        verticalWallHitY = nextVerticalTouchY;

        break;
        // WE FOUND A WALL
      } else {
        // otherwise we keep increamenting by deltaX and deltaY
        nextVerticalTouchX += deltaX;
        nextVerticalTouchY += deltaY;
      }
    }
    // Calculate both horizontal and vertical distances and choose the smallest value
    // using Pythagorean theorem to find distance of wall hit
    var horizontalHitDistance = foundHorizonalWallHit
      ? distanceBetweenPoints(
          player.x,
          player.y,
          horizontalWallHitX,
          horizontalWallHitY
        )
      : Number.MAX_VALUE;
    var verticalHitDistance = foundVerticalWallHit
      ? distanceBetweenPoints(
          player.x,
          player.y,
          verticalWallHitX,
          verticalWallHitY
        )
      : Number.MAX_VALUE;
    // if no value if found we assign the horizontal distance to the max value we can hold

    // checking which wall hit on the x axis is smaller
    // only store smallest distances
    this.wallHitX =
      horizontalHitDistance < verticalHitDistance
        ? horizontalWallHitX
        : verticalWallHitX;

    this.wallHitY =
      horizontalHitDistance < verticalHitDistance
        ? horizontalWallHitY
        : verticalWallHitY;

    //! the real comparison of horizonal and veritical distances
    this.distance =
      horizontalHitDistance < verticalHitDistance
        ? horizontalHitDistance
        : verticalHitDistance;
    this.wasHitVertical = verticalHitDistance < horizontalHitDistance;
  }

  render() {
    stroke("rgba(0, 225, 20, 0.3)");
    line(
      MINIMAP_SCALE_FACTOR * player.x,
      MINIMAP_SCALE_FACTOR * player.y,
      MINIMAP_SCALE_FACTOR * this.wallHitX,
      MINIMAP_SCALE_FACTOR * this.wallHitY
    );
  }
}

var grid = new Map();
var player = new Player();
var rays = [];

function keyTyped() {
  if (key == "w") {
    player.walkDirection = 1;
  } else if (key == "s") {
    player.walkDirection = -1;
  } else if (key == "d") {
    player.turnDirection = 1;
  } else if (key == "a") {
    player.turnDirection = -1;
  }
}

function keyReleased() {
  if (key == "w") {
    player.walkDirection = 0;
  } else if (key == "s") {
    player.walkDirection = 0;
  } else if (key == "d") {
    player.turnDirection = 0;
  } else if (key == "a") {
    player.turnDirection = 0;
  }
}

function castAllRays() {
  // start first ray by subtracting player angle by half of the FOV
  var rayAngle = player.rotationAngle - FOV_ANGLE / 2;
  rays = [];

  // loop all columns casting the rays
  //   for (var i = 0; i < NUM_RAYS; i++) {
  for (var col = 0; col < NUM_RAYS; col++) {
    var ray = new Ray(rayAngle);
    ray.cast();
    rays.push(ray); // add ray to the list of rays

    rayAngle += FOV_ANGLE / NUM_RAYS;
  }
}

function render3DProjectedWalls() {
  // distance and angle for each ray is already calculated within the ray instance of the Ray class
  // loop every ray in the array of rays
  for (var i = 0; i < NUM_RAYS; i++) {
    var ray = rays[i];

    var correctWallDistance =
      ray.distance * Math.cos(ray.rayAngle - player.rotationAngle);
    // Think, we need to get the adjacent side of a right triangle of our view
    // we do this my halving our window width and dividing it by the tan of half
    // of our FOV, so: adj = (WINDOW_WIDTH/2) / tan(FOV_ANGLE/2)
    var distanceToProjectionPlane = WINDOW_WIDTH / 2 / Math.tan(FOV_ANGLE / 2);
    // projected wall height
    var wallStripHeight =
      (TILE_SIZE / correctWallDistance) * distanceToProjectionPlane;

    // compute the transparency based on the wall distance
    var alpha = 300 / correctWallDistance;

    // if the hit interection is horizontal we get a darker shade
    var shade = ray.wasHitVertical ? 1 : 0.7;

    fill(
      "rgba(" +
        int(shade * 255) +
        "," +
        int(shade * 182) +
        "," +
        int(shade * 193) +
        "," +
        alpha +
        ")"
    );
    noStroke();
    rect(
      i * WALL_STRIP_WIDTH,
      // putting it in the middle of the screen and shorting it by half of the height of the real wall
      WINDOW_HEIGHT / 2 - wallStripHeight / 2,
      WALL_STRIP_WIDTH,
      wallStripHeight
    );
  }
}

function normalizeAngle(angle) {
  // making sure the angle is always within 360 or 2π
  angle = angle % (2 * Math.PI);
  if (angle < 0) {
    angle = 2 * Math.PI + angle; // keeping the angle positive
  }
  return angle;
}

function distanceBetweenPoints(x1, y1, x2, y2) {
  // PYTHAGOREAN THEOREM
  return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
  //Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))
}

function setup() {
  // TODO: initialize all objects
  createCanvas(WINDOW_WIDTH, WINDOW_HEIGHT);
}

function update() {
  // TODO: update all game objects before we render the next frame
  player.update();
  castAllRays();
}

// update and draw are better kept as seperate functions

function draw() {
  clear("#212121");
  // TODO: render all objects frame by frame
  update(); // calling update first causes the screen to beupdated frame by frame

  render3DProjectedWalls();

  grid.render();

  // translation: for ray in rays
  for (ray of rays) {
    ray.render();
  }
  player.render();
}
