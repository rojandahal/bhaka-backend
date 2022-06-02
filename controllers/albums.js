const fs = require('fs');
const md5 = require('md5');

const validationCheck = require('../hooks/validationCheck');

const { sequelize } = require('../initDb');

const Album = require('../models/album');
const Song = require('../models/song');

const authorizeArtistAccount = require('../hooks/authorizeArtistAccount');

const create = async (req, res, next) => {
  validationCheck(req, next);

  const { title, songs, type, artist } = req.body;

  let songArray = JSON.parse(songs);

  authorizeArtistAccount(req, next);

  const transac = await sequelize.transaction();

  try {
    let albumSongs = [];

    // create entry for new album
    const newAlbum = await Album.create(
      {
        title,
        type,
        songs: [],
        artist,
        coverArt: req.files.coverImage[0].path,
      },
      { transaction: transac }
    );

    // create entry for all songs in the album
    for (let i = 0; i < songArray.length; i++) {
      let songMd5;
      const buf = fs.readFileSync(req.files.songFiles[i].path);
      songMd5 = md5(buf);

      const newSong = await Song.create(
        {
          title: songArray[i].title,
          artist: artist,
          featuredArtist: songArray[i].featuredArtist,
          genre: songArray[i].genre,
          album: newAlbum.id,
          hash: songMd5,
          filePath: req.files.songFiles[i].path,
        },
        { transaction: transac }
      );
      albumSongs.push(newSong.id);
    }

    // update new album with newly entered songs
    await Album.update(
      {
        songs: albumSongs,
      },
      {
        where: {
          id: newAlbum.id,
        },
        transaction: transac,
      }
    );

    await transac.commit();
    res.json({ albumId: newAlbum.id });
  } catch (error) {
    console.log(error);
    await transac.rollback();
  }
};

exports.create = create;