import express from "express";
import DB from "../../../../core/config/knex.js";
import { formatDateSystem } from "../../components/tools/date_tools.js";
import { Logging } from "../../components/tools/servertool.js";
import { status } from "../../components/tools/general.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const oPayload = req.body;
  const username = req?.auth?.username || "";
  const keyword = oPayload.keyword || "";
  const filterStatus = oPayload.status || null;
  const page = parseInt(oPayload.page) || 1;
  const perPage = parseInt(oPayload.perPage) || 10;
  const hasPagination = oPayload.page !== undefined || oPayload.perPage !== undefined;

  try {
    const hasStatusCol = await DB.schema.hasColumn("mst_detail_promo", "status");
    if (!hasStatusCol) {
      await DB.schema.table("mst_detail_promo", (table) => {
        table.enum("status", ["aktif", "nonaktif"]).notNullable().defaultTo("aktif").after("kode_item");
      });
    }

    const baseQuery = DB("mst_promo as p").modify((qb) => {
      if (keyword) {
        const lower = keyword.toLowerCase();
        qb.where(function () {
          this.whereRaw("LOWER(p.kode_promo) LIKE ?", [`%${lower}%`])
            .orWhereRaw("LOWER(p.nama) LIKE ?", [`%${lower}%`])
            .orWhereExists(function () {
              this.select("*")
                .from("mst_detail_promo as dp")
                .leftJoin("mst_produk as pr", "dp.kode_item", "pr.kode_produk")
                .whereRaw("dp.kode_promo = p.kode_promo")
                .where(function () {
                  this.whereRaw("LOWER(pr.nama) LIKE ?", [`%${lower}%`])
                    .orWhereRaw("LOWER(pr.kode_produk) LIKE ?", [`%${lower}%`]);
                });
            });
        });
      }
      if (filterStatus) qb.where("p.status", filterStatus);
    });

    const selectFields = [
      "p.id",
      "p.kode_promo",
      "p.nama",
      "p.jenis_diskon",
      "p.nilai_diskon",
      DB.raw("DATE_FORMAT(p.tanggal_mulai, '%Y-%m-%d') as tanggal_mulai"),
      DB.raw("DATE_FORMAT(p.tanggal_selesai, '%Y-%m-%d') as tanggal_selesai"),
      DB.raw("GREATEST(0, DATEDIFF(p.tanggal_selesai, CURDATE())) as sisa_hari"),
      "p.status",
      "p.created_by",
      "p.created_at",
      "p.updated_at",
    ];

    let totalRecords = 0;
    let vaData = [];

    if (hasPagination) {
      const offset = (page - 1) * perPage;
      const countResult = await baseQuery.clone().count("p.id as total").first();
      totalRecords = parseInt(countResult.total || 0);
      vaData = await baseQuery.clone().select(selectFields).orderBy("p.created_at", "desc").limit(perPage).offset(offset);
    } else {
      vaData = await baseQuery.clone().select(selectFields).orderBy("p.created_at", "desc");
      totalRecords = vaData.length;
    }

    // Load detail products for each promo
    for (const item of vaData) {
      const details = await DB("mst_detail_promo as dp")
        .leftJoin("mst_produk as pr", "dp.kode_item", "pr.kode_produk")
        .leftJoin("mst_kategori_produk as kp", "pr.kode_kategori_produk", "kp.kode_kategori_produk")
        .where("dp.kode_promo", item.kode_promo)
        .where("dp.jenis_item", "produk")
        .select(
          "dp.id",
          "dp.kode_detail_promo",
          "dp.kode_promo",
          "dp.kode_item as kode_produk",
          "pr.nama as nama_produk",
          "kp.nama as nama_kategori",
          "pr.harga_jual as harga_normal",
          "pr.satuan",
          "pr.stok_tersedia",
          "dp.status"
        );

      for (const d of details) {
        const hargaNormal = parseFloat(d.harga_normal) || 0;
        const nilaiDiskon = parseFloat(item.nilai_diskon) || 0;
        let hargaPromo = hargaNormal;
        let hemat = 0;

        if (item.jenis_diskon === "persen") {
          hargaPromo = Math.round(hargaNormal * (1 - nilaiDiskon / 100));
          hemat = Math.max(0, hargaNormal - hargaPromo);
        } else {
          hargaPromo = Math.max(0, Math.round(hargaNormal - nilaiDiskon));
          hemat = Math.min(hargaNormal, nilaiDiskon);
        }

        d.harga_promo = hargaPromo;
        d.hemat = hemat;
      }

      item.details = details;
    }

    return res.status(200).json({
      status: status.SUKSES,
      message: "Data ditemukan",
      datetime: formatDateSystem(),
      data: vaData,
      total_data: totalRecords,
    });
  } catch (error) {
    const oResult = { status: status.BAD_REQUEST, message: "Sistem sedang maintenance", datetime: formatDateSystem() };
    Logging(error, { file: "/master/detail_promo/detail_promo_data.js", func: "data", request: oPayload, response: oResult, user: username });
    return res.status(500).json(oResult);
  }
});

export default router;
