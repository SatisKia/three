#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_LINE 4096
#define MAX_NAME 256
#define MAX_PATH 512

typedef struct {
	char name[MAX_NAME];
	float col[3];
	float dif;
	float amb;
	float spc;
	float emi;
	float power;
	char tex[MAX_PATH];
	int has_tex;
} Material;

typedef struct {
	float x, y, z;
} Vec3;

typedef struct {
	int v[4];
	int v_num;
	int mat;
	float uv[8];
	int has_uv;
} Face;

typedef struct {
	Vec3* verts;
	int vert_num;
	Face* faces;
	int face_num;
} Object;

static char line[MAX_LINE];

static void skip_ws(char** p) {
	while ( **p == ' ' || **p == '\t' || **p == '\r' || **p == '\n' ) {
		(*p)++;
	}
}

static void word(char** p, char* out, int out_size) {
	char* start;
	int len;

	skip_ws(p);
	start = *p;
	while ( **p && **p != ' ' && **p != '\t' && **p != '\r' && **p != '\n' && **p != ')' ) {
		(*p)++;
	}
	len = (int)(*p - start);
	if ( len >= out_size ) {
		len = out_size - 1;
	}
	memcpy(out, start, len);
	out[len] = '\0';
}

static void quoted_string(char** p, char* out, int out_size) {
	char* start;
	int len;

	skip_ws(p);
	if ( **p == '"' ) {
		(*p)++;
	}
	start = *p;
	while ( **p && **p != '"' ) {
		(*p)++;
	}
	len = (int)(*p - start);
	if ( len >= out_size ) {
		len = out_size - 1;
	}
	memcpy(out, start, len);
	out[len] = '\0';
	if ( **p == '"' ) {
		(*p)++;
	}
}

static char* find_token(char* buf, const char* token) {
	char* p = strstr(buf, token);
	if ( p ) {
		return p + strlen(token);
	}
	return NULL;
}

static void get_line(char** p) {
	int i = 0;

	while ( **p && **p != '\n' ) {
		if ( i < MAX_LINE - 1 ) {
			line[i++] = **p;
		}
		(*p)++;
	}
	line[i] = '\0';
	if ( **p == '\n' ) {
		(*p)++;
	}
}

static void skip_line(char** p) {
	while ( **p && **p != '\n' ) {
		(*p)++;
	}
	if ( **p == '\n' ) {
		(*p)++;
	}
}

static int parse_vertex_index(const char* token) {
	if ( token[0] == 'V' && token[1] == '(' ) {
		return atoi(token + 2);
	}
	return atoi(token);
}

static char* change_ext(const char* path, const char* ext, char* out, int out_size) {
	const char* dot;
	int base_len;

	strcpy(out, path);
	dot = strrchr(out, '.');
	if ( dot ) {
		base_len = (int)(dot - out);
		out[base_len] = '\0';
	}
	if ( (int)strlen(out) + (int)strlen(ext) + 1 >= out_size ) {
		return NULL;
	}
	strcat(out, ext);
	return out;
}

static char* basename_only(const char* path, char* out, int out_size) {
	const char* p = path;
	const char* name = path;

	while ( *p ) {
		if ( *p == '\\' || *p == '/' ) {
			name = p + 1;
		}
		p++;
	}
	strncpy(out, name, out_size - 1);
	out[out_size - 1] = '\0';
	return out;
}

static int load_file(const char* path, char** out_buf) {
	FILE* fp;
	long size;
	char* buf;
	size_t read_size;

	fp = fopen(path, "rb");
	if ( !fp ) {
		return 0;
	}
	fseek(fp, 0, SEEK_END);
	size = ftell(fp);
	fseek(fp, 0, SEEK_SET);
	if ( size < 0 ) {
		fclose(fp);
		return 0;
	}
	buf = (char*)malloc((size_t)size + 1);
	if ( !buf ) {
		fclose(fp);
		return 0;
	}
	read_size = fread(buf, 1, (size_t)size, fp);
	buf[read_size] = '\0';
	fclose(fp);
	*out_buf = buf;
	return 1;
}

static int parse_materials(char* buf, Material** out_mats, int* out_num) {
	char* cur;
	char tmp[256];
	int count;
	int i;
	Material* mats;

	cur = find_token(buf, "Material ");
	if ( !cur ) {
		*out_mats = NULL;
		*out_num = 0;
		return 1;
	}
	word(&cur, tmp, sizeof(tmp));
	count = atoi(tmp);
	if ( count <= 0 ) {
		*out_mats = NULL;
		*out_num = 0;
		return 1;
	}
	skip_line(&cur);

	mats = (Material*)calloc((size_t)count, sizeof(Material));
	if ( !mats ) {
		return 0;
	}

	for ( i = 0; i < count; i++ ) {
		char* line_cur;
		char* dif_p;
		char* amb_p;
		char* spc_p;
		char* col_p;
		char* tex_p;
		char* power_p;

		get_line(&cur);
		line_cur = line;

		quoted_string(&line_cur, mats[i].name, sizeof(mats[i].name));
		mats[i].col[0] = mats[i].col[1] = mats[i].col[2] = 1.0f;
		mats[i].dif = 0.8f;
		mats[i].amb = 0.6f;
		mats[i].spc = 0.0f;
		mats[i].emi = 0.0f;
		mats[i].power = 5.0f;
		mats[i].has_tex = 0;
		mats[i].tex[0] = '\0';

		col_p = strstr(line, "col(");
		if ( col_p ) {
			col_p += 4;
			word(&col_p, tmp, sizeof(tmp));
			mats[i].col[0] = (float)atof(tmp);
			word(&col_p, tmp, sizeof(tmp));
			mats[i].col[1] = (float)atof(tmp);
			word(&col_p, tmp, sizeof(tmp));
			mats[i].col[2] = (float)atof(tmp);
		}
		dif_p = strstr(line, "dif(");
		if ( dif_p ) {
			dif_p += 4;
			word(&dif_p, tmp, sizeof(tmp));
			mats[i].dif = (float)atof(tmp);
		}
		amb_p = strstr(line, "amb(");
		if ( amb_p ) {
			amb_p += 4;
			word(&amb_p, tmp, sizeof(tmp));
			mats[i].amb = (float)atof(tmp);
		}
		spc_p = strstr(line, "spc(");
		if ( spc_p ) {
			spc_p += 4;
			word(&spc_p, tmp, sizeof(tmp));
			mats[i].spc = (float)atof(tmp);
		}
		power_p = strstr(line, "power(");
		if ( power_p ) {
			power_p += 6;
			word(&power_p, tmp, sizeof(tmp));
			mats[i].power = (float)atof(tmp);
		}
		tex_p = strstr(line, "tex(");
		if ( tex_p ) {
			tex_p += 4;
			quoted_string(&tex_p, mats[i].tex, sizeof(mats[i].tex));
			basename_only(mats[i].tex, mats[i].tex, sizeof(mats[i].tex));
			mats[i].has_tex = mats[i].tex[0] != '\0';
		}
	}

	*out_mats = mats;
	*out_num = count;
	return 1;
}

static int count_objects(char* buf) {
	char* cur = buf;
	int count = 0;

	while ( (cur = find_token(cur, "Object ")) != NULL ) {
		count++;
	}
	return count;
}

static int parse_object(char** buf_cur, Object* obj) {
	char* cur = *buf_cur;
	char tmp[256];
	int i;
	int j;

	obj->verts = NULL;
	obj->vert_num = 0;
	obj->faces = NULL;
	obj->face_num = 0;

	if ( !find_token(cur, "vertex ") ) {
		return 0;
	}
	cur = find_token(cur, "vertex ");
	word(&cur, tmp, sizeof(tmp));
	obj->vert_num = atoi(tmp);
	if ( obj->vert_num <= 0 ) {
		return 0;
	}

	obj->verts = (Vec3*)malloc((size_t)obj->vert_num * sizeof(Vec3));
	if ( !obj->verts ) {
		return 0;
	}
	skip_line(&cur);
	for ( i = 0; i < obj->vert_num; i++ ) {
		word(&cur, tmp, sizeof(tmp));
		obj->verts[i].x = (float)atof(tmp);
		word(&cur, tmp, sizeof(tmp));
		obj->verts[i].y = (float)atof(tmp);
		word(&cur, tmp, sizeof(tmp));
		obj->verts[i].z = (float)atof(tmp);
	}

	if ( !find_token(cur, "face ") ) {
		return 0;
	}
	cur = find_token(cur, "face ");
	word(&cur, tmp, sizeof(tmp));
	obj->face_num = atoi(tmp);
	if ( obj->face_num <= 0 ) {
		return 0;
	}

	obj->faces = (Face*)calloc((size_t)obj->face_num, sizeof(Face));
	if ( !obj->faces ) {
		return 0;
	}
	skip_line(&cur);

	for ( i = 0; i < obj->face_num; i++ ) {
		char* line_cur;
		Face* face = &obj->faces[i];

		get_line(&cur);
		line_cur = line;

		word(&line_cur, tmp, sizeof(tmp));
		face->v_num = atoi(tmp);
		if ( face->v_num < 3 || face->v_num > 4 ) {
			return 0;
		}

		for ( j = 0; j < face->v_num; j++ ) {
			word(&line_cur, tmp, sizeof(tmp));
			face->v[j] = parse_vertex_index(tmp);
		}

		face->mat = -1;
		{
			char* mp = strstr(line, "M(");
			if ( mp ) {
				mp += 2;
				word(&mp, tmp, sizeof(tmp));
				face->mat = atoi(tmp);
			}
		}

		face->has_uv = 0;
		{
			char* up = strstr(line, "UV(");
			if ( up ) {
				up += 3;
				face->has_uv = 1;
				for ( j = 0; j < face->v_num * 2; j++ ) {
					word(&up, tmp, sizeof(tmp));
					face->uv[j] = (float)atof(tmp);
				}
			}
		}
	}

	*buf_cur = cur;
	return 1;
}

static void free_object(Object* obj) {
	free(obj->verts);
	free(obj->faces);
	obj->verts = NULL;
	obj->faces = NULL;
	obj->vert_num = 0;
	obj->face_num = 0;
}

// 法線
static void vec3_add(Vec3* a, Vec3 b) {
	a->x += b.x;
	a->y += b.y;
	a->z += b.z;
}
static float vec3_len(Vec3 v) {
	return sqrtf(v.x * v.x + v.y * v.y + v.z * v.z);
}
static void vec3_normalize(Vec3* v) {
	float len = vec3_len(*v);

	if ( len > 1e-10f ) {
		v->x /= len;
		v->y /= len;
		v->z /= len;
	}
}
static Vec3 compute_face_normal(const Object* obj, const Face* face) {
	Vec3 n = { 0.0f, 0.0f, 0.0f };
	int i;

	for ( i = 0; i < face->v_num; i++ ) {
		int i0 = face->v[i];
		int i1 = face->v[(i + 1) % face->v_num];
		const Vec3* v0 = &obj->verts[i0];
		const Vec3* v1 = &obj->verts[i1];

		n.x += (v0->y - v1->y) * (v0->z + v1->z);
		n.y += (v0->z - v1->z) * (v0->x + v1->x);
		n.z += (v0->x - v1->x) * (v0->y + v1->y);
	}
	vec3_normalize(&n);
	return n;
}
static Vec3* compute_vertex_normals(const Object* obj) {
	Vec3* normals;
	int i;
	int j;

	normals = (Vec3*)calloc((size_t)obj->vert_num, sizeof(Vec3));
	if ( !normals ) {
		return NULL;
	}

	for ( i = 0; i < obj->face_num; i++ ) {
		const Face* face = &obj->faces[i];
		Vec3 fn = compute_face_normal(obj, face);

		for ( j = 0; j < face->v_num; j++ ) {
			vec3_add(&normals[face->v[j]], fn);
		}
	}

	for ( i = 0; i < obj->vert_num; i++ ) {
		vec3_normalize(&normals[i]);
		if ( vec3_len(normals[i]) < 1e-10f ) {
			normals[i].x = 0.0f;
			normals[i].y = 0.0f;
			normals[i].z = 1.0f;
		}
	}

	return normals;
}

static int write_mtl(const char* path, Material* mats, int mat_num) {
	FILE* fp;
	int i;

	fp = fopen(path, "wt");
	if ( !fp ) {
		fprintf(stderr, "error: cannot write %s\n", path);
		return 0;
	}

	fprintf(fp, "# Created by mqo2obj\n\n");
	for ( i = 0; i < mat_num; i++ ) {
		fprintf(fp, "newmtl %s\n", mats[i].name);
		fprintf(fp, "Ka %.5f %.5f %.5f\n",
			mats[i].amb * mats[i].col[0],
			mats[i].amb * mats[i].col[1],
			mats[i].amb * mats[i].col[2]);
		fprintf(fp, "Kd %.5f %.5f %.5f\n",
			mats[i].dif * mats[i].col[0],
			mats[i].dif * mats[i].col[1],
			mats[i].dif * mats[i].col[2]);
		fprintf(fp, "Ks %.5f %.5f %.5f\n",
			mats[i].spc * mats[i].col[0],
			mats[i].spc * mats[i].col[1],
			mats[i].spc * mats[i].col[2]);
		fprintf(fp, "Ns %.5f\n", mats[i].power);
		if ( mats[i].has_tex ) {
			fprintf(fp, "map_Kd %s\n", mats[i].tex);
		}
		fprintf(fp, "\n");
	}

	fclose(fp);
	return 1;
}

char* progName(char* argv0) {
	char* szTop;
	char* szTmp;
	szTop = argv0;
	if ( (szTmp = strrchr(szTop, '\\')) != NULL ) {
		szTop = szTmp + 1;
	}
	if ( (szTmp = strrchr(szTop, '.')) != NULL ) {
		*szTmp = '\0';
	}
	return strlwr(szTop);
}

int main(int argc, char* argv[]) {
	const char* in_path;
	const char* out_obj_path = NULL;

	char* buf;
	char* cur;
	char obj_path[MAX_PATH];
	char mtl_path[MAX_PATH];
	char mtl_name[MAX_PATH];
	FILE* obj_fp;
	Material* mats = NULL;
	int mat_num = 0;
	int obj_count;
	int obj_index;
	int vertex_offset = 0;
	int vt_count = 0;
	int last_mat = -2;

	int export_normals = 0;
	int arg_cur = 1;
	Vec3* normals = NULL;

	while ( arg_cur < argc && argv[arg_cur][0] == '-' ) {
		if ( strcmp(argv[arg_cur], "-n") == 0 ) {
			export_normals = 1;
			arg_cur++;
		} else {
			fprintf(stderr, "error: unknown option %s\n", argv[arg_cur]);
			return 0;
		}
	}

	if ( arg_cur >= argc ) {
		printf("usage: %s [-n] <input.mqo> [output.obj]\n", progName(argv[0]));
		return 0;
	}
	in_path = argv[arg_cur++];
	if ( arg_cur < argc ) {
		out_obj_path = argv[arg_cur];
	}

	if ( !load_file(in_path, &buf) ) {
		fprintf(stderr, "error: cannot read %s\n", in_path);
		return 0;
	}

	if ( !parse_materials(buf, &mats, &mat_num) ) {
		fprintf(stderr, "error: out of memory\n");
		free(buf);
		return 0;
	}

	if ( out_obj_path ) {
		strncpy(obj_path, out_obj_path, sizeof(obj_path) - 1);
		obj_path[sizeof(obj_path) - 1] = '\0';
	} else {
		change_ext(in_path, ".obj", obj_path, sizeof(obj_path));
	}
	change_ext(obj_path, ".mtl", mtl_path, sizeof(mtl_path));
	basename_only(mtl_path, mtl_name, sizeof(mtl_name));

	if ( !write_mtl(mtl_path, mats, mat_num) ) {
		free(mats);
		free(buf);
		return 0;
	}

	obj_fp = fopen(obj_path, "wt");
	if ( !obj_fp ) {
		fprintf(stderr, "error: cannot write %s\n", obj_path);
		free(mats);
		free(buf);
		return 0;
	}

	fprintf(obj_fp, "# Created by mqo2obj\n\n");
	fprintf(obj_fp, "mtllib %s\n\n", mtl_name);

	obj_count = count_objects(buf);
	cur = buf;
	for ( obj_index = 0; obj_index < obj_count; obj_index++ ) {
		Object obj;
		int i;
		int j;

		cur = find_token(cur, "Object ");
		if ( !cur ) {
			break;
		}
		if ( !parse_object(&cur, &obj) ) {
			continue;
		}

		if ( export_normals ) {
			normals = compute_vertex_normals(&obj);
			if ( !normals ) {
				fprintf(stderr, "error: out of memory\n");
				free_object(&obj);
				fclose(obj_fp);
				free(mats);
				free(buf);
				return 0;
			}
		}

		for ( i = 0; i < obj.vert_num; i++ ) {
			fprintf(obj_fp, "v %.6f %.6f %.6f\n", obj.verts[i].x, obj.verts[i].y, obj.verts[i].z);
		}
		fprintf(obj_fp, "# %d vertices\n\n", obj.vert_num);

		if ( export_normals ) {
			for ( i = 0; i < obj.vert_num; i++ ) {
				fprintf(obj_fp, "vn %.4f %.4f %.4f\n", normals[i].x, normals[i].y, normals[i].z);
			}
			fprintf(obj_fp, "# %d vertex normals\n\n", obj.vert_num);
		}

		for ( i = 0; i < obj.face_num; i++ ) {
			Face* face = &obj.faces[i];
			const Material* mat;

			if ( face->mat < 0 || face->mat >= mat_num ) {
				mat = NULL;
			} else {
				mat = &mats[face->mat];
			}

			if ( face->mat != last_mat ) {
				if ( mat ) {
					fprintf(obj_fp, "usemtl %s\n", mat->name);
				}
				last_mat = face->mat;
			}

			if ( face->has_uv ) {
				for ( j = 0; j < face->v_num; j++ ) {
					float u = face->uv[j * 2];
					float v = face->uv[j * 2 + 1];
					fprintf(obj_fp, "vt %.5f %.5f\n", u, 1.0f - v);
					vt_count++;
				}

				fprintf(obj_fp, "f");
				for ( j = 0; j < face->v_num; j++ ) {
					int v_idx = face->v[j] + 1 + vertex_offset;
					int vt_idx = vt_count - face->v_num + j + 1;
					if ( export_normals ) {
						fprintf(obj_fp, " %d/%d/%d", v_idx, vt_idx, v_idx);
					} else {
						fprintf(obj_fp, " %d/%d", v_idx, vt_idx);
					}
				}
				fprintf(obj_fp, "\n");
			} else {
				fprintf(obj_fp, "f");
				for ( j = 0; j < face->v_num; j++ ) {
					int v_idx = face->v[j] + 1 + vertex_offset;
					if ( export_normals ) {
						fprintf(obj_fp, " %d//%d", v_idx, v_idx);
					} else {
						fprintf(obj_fp, " %d", v_idx);
					}
				}
				fprintf(obj_fp, "\n");
			}
		}
		fprintf(obj_fp, "# %d faces\n\n", obj.face_num);

		vertex_offset += obj.vert_num;
		if ( export_normals ) {
			free(normals);
			normals = NULL;
		}
		free_object(&obj);
	}

	fclose(obj_fp);
	free(mats);
	free(buf);

	printf("converted: %s -> %s, %s\n", in_path, obj_path, mtl_path);
	return 0;
}
